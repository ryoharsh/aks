import type {
    RealtimeAudioHardware,
    RealtimeConversationSession,
    RealtimeEvent,
    RealtimeProviderAdapter,
    RealtimeSessionProtocol,
    RealtimeSessionSpec,
    RealtimeTransport,
    VoiceState,
} from "./types";
import { MirrorRealtimeError, realTimeErrorMessage } from "./types";
import { assertRealtimeAudioSupported } from "./audio/realtime-audio";
import { createRealtimeTransport } from "./transports/realtime-transport";
import { createRealtimeProtocol } from "./protocols/realtime.protocol-registry";

export type RealtimeConversationDeps = {
    getConversationId: () => string | null;
    adapter: RealtimeProviderAdapter;
    getAudio: () => Promise<RealtimeAudioHardware>;
    onEvent: (event: RealtimeEvent) => void;
    createProtocol?: (spec: RealtimeSessionSpec) => RealtimeSessionProtocol;
    createTransport?: (spec: RealtimeSessionSpec) => RealtimeTransport;
    reconnect?: { maxAttempts: number; baseDelayMs: number };
};

const DEFAULT_RECONNECT = { maxAttempts: 4, baseDelayMs: 500 };
const MAX_RECONNECT_DELAY_MS = 8000;

function wait(durationMs: number) {
    return new Promise((resolve) => setTimeout(resolve, durationMs));
}

export function createRealtimeConversationSession(deps: RealtimeConversationDeps): RealtimeConversationSession {
    const reconnect = { ...DEFAULT_RECONNECT, ...deps.reconnect };
    const createProtocol = deps.createProtocol ?? createRealtimeProtocol;
    const createTransport = deps.createTransport ?? createRealtimeTransport;

    const listeners = new Set<(event: RealtimeEvent) => void>();
    let state: VoiceState = "idle";
    let audio: RealtimeAudioHardware | null = null;
    let activeSpec: RealtimeSessionSpec | null = null;
    let protocol: RealtimeSessionProtocol | null = null;
    let transport: RealtimeTransport | null = null;
    let unsubscribeMessage: (() => void) | null = null;
    let unsubscribeClose: (() => void) | null = null;
    let unsubscribeError: (() => void) | null = null;
    let stoppedByUser = false;
    let captureStarted = false;
    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let assistantText = "";
    let userTranscript = "";

    const emit = (event: RealtimeEvent) => {
        listeners.forEach((listener) => listener(event));
        deps.onEvent(event);
    };

    const requireAudio = (): RealtimeAudioHardware => {
        if (!audio) {
            throw new MirrorRealtimeError("REALTIME_AUDIO_UNAVAILABLE", false, realTimeErrorMessage("REALTIME_AUDIO_UNAVAILABLE"));
        }
        return audio;
    };

    const detachTransport = () => {
        unsubscribeMessage?.();
        unsubscribeClose?.();
        unsubscribeError?.();
        unsubscribeMessage = null;
        unsubscribeClose = null;
        unsubscribeError = null;
    };

    const send = (payloads: unknown[]) => {
        if (!transport) return;
        for (const payload of payloads) transport.send(payload);
    };

    const ensureCaptureStarted = async () => {
        if (captureStarted || !activeSpec) return;
        const hardware = requireAudio();
        await hardware.startCapture(
            activeSpec.inputSampleRate,
            (pcmBase64) => {
                if (!activeSpec || captureStarted !== true) return;
                if (state === "listening" || state === "userSpeaking" || state === "connected") {
                    send(protocol?.build({ type: "userAudioFrame", pcmBase64 }) ?? []);
                }
            },
            (error) => {
                emit({
                    type: "error",
                    code: "REALTIME_AUDIO_UNAVAILABLE",
                    message: error.message || realTimeErrorMessage("REALTIME_AUDIO_UNAVAILABLE"),
                    retryable: false,
                });
            },
        );
        captureStarted = true;
    };

    const openSession = async () => {
        const conversationId = deps.getConversationId();
        const spec = await deps.adapter.createSession({ conversationId });

        protocol = createProtocol(spec);
        transport = createTransport(spec);
        if (!transport) {
            throw new MirrorRealtimeError("REALTIME_TRANSPORT_UNAVAILABLE", false, realTimeErrorMessage("REALTIME_TRANSPORT_UNAVAILABLE"));
        }

        unsubscribeMessage = transport.onMessage((raw) => {
            if (!protocol) return;
            for (const event of protocol.parse(raw)) apply(event);
        });
        unsubscribeClose = transport.onClose((info) => {
            if (stoppedByUser || state === "ended" || state === "ending") return;
            if (info.wasClean) return;
            void handleUnexpectedClose();
        });
        unsubscribeError = transport.onError(() => {
            if (stoppedByUser || state === "ended") return;
            emit({ type: "error", code: "REALTIME_PROVIDER_ERROR", message: realTimeErrorMessage("REALTIME_PROVIDER_ERROR"), retryable: true });
        });

        activeSpec = spec;
        await transport.connect(spec);
        send(protocol.build({ type: "sessionStart" }));
        await requireAudio().startPlayback(spec.outputSampleRate);
    };

    const apply = (event: RealtimeEvent) => {
        switch (event.type) {
            case "sessionConnecting":
                state = "connecting";
                emit(event);
                return;
            case "sessionReady":
                state = "connected";
                emit(event);
                return;
            case "listening":
                state = "listening";
                emit(event);
                void ensureCaptureStarted();
                return;
            case "userSpeechStarted": {
                if (state === "assistantSpeaking" || state === "thinking") {
                    send(protocol?.build({ type: "cancelResponse" }) ?? []);
                    requireAudio().interruptPlayback();
                    emit({ type: "assistantInterrupted" });
                    assistantText = "";
                }
                state = "userSpeaking";
                emit(event);
                return;
            }
            case "userTranscriptDelta":
                userTranscript = event.transcript;
                emit(event);
                return;
            case "userTranscriptFinal":
                userTranscript = event.transcript;
                emit(event);
                return;
            case "thinking":
                state = "thinking";
                emit(event);
                return;
            case "assistantResponseStarted":
                emit(event);
                return;
            case "assistantTextDelta":
                state = state === "userSpeaking" ? "thinking" : state === "thinking" ? "assistantSpeaking" : state;
                if (state !== "assistantSpeaking") state = "assistantSpeaking";
                assistantText += event.text;
                emit(event);
                return;
            case "assistantTextFinal":
                state = state === "userSpeaking" ? "thinking" : "assistantSpeaking";
                emit({ ...event, text: assistantText });
                return;
            case "assistantAudioStarted":
                state = "assistantSpeaking";
                emit(event);
                return;
            case "assistantAudioChunk":
                requireAudio().enqueuePcm(event.pcmBase64, activeSpec?.outputSampleRate ?? 24000);
                emit(event);
                return;
            case "assistantAudioFinished":
                emit(event);
                void requireAudio().flushPlayback();
                return;
            case "assistantInterrupted":
                assistantText = "";
                emit(event);
                return;
            case "turnCompleted":
                state = "listening";
                userTranscript = "";
                assistantText = "";
                emit(event);
                return;
            case "reconnecting":
                state = "reconnecting";
                emit(event);
                return;
            case "reconnected":
                state = "listening";
                reconnectAttempts = 0;
                emit(event);
                void ensureCaptureStarted();
                return;
            case "error":
                state = "error";
                emit(event);
                return;
            case "sessionEnded":
                state = "ended";
                emit(event);
                return;
        }
    };

    const stopCaptureAndPlayback = async () => {
        const hardware = requireAudio();
        await hardware.stopCapture().catch(() => undefined);
        await hardware.stopPlayback().catch(() => undefined);
    };

    const start = async () => {
        if (state !== "idle" && state !== "ended") return;
        stoppedByUser = false;
        reconnectAttempts = 0;

        const hardware = await deps.getAudio();
        audio = hardware;
        assertRealtimeAudioSupported(hardware.support);
        const permission = await hardware.requestMicPermission();
        if (permission !== "granted") {
            stopCaptureAndPlayback();
            throw new MirrorRealtimeError("REALTIME_MIC_PERMISSION_DENIED", false, realTimeErrorMessage("REALTIME_MIC_PERMISSION_DENIED"));
        }

        emit({ type: "sessionConnecting" });
        state = "connecting";
        try {
            await openSession();
        } catch (error) {
            if (error instanceof MirrorRealtimeError) {
                emit({ type: "error", code: error.code, message: error.message, retryable: error.retryable });
            } else {
                emit({ type: "error", code: "REALTIME_PROVIDER_ERROR", message: realTimeErrorMessage("REALTIME_PROVIDER_ERROR"), retryable: true });
            }
            state = "error";
            await stopCaptureAndPlayback();
            detachTransport();
            throw error;
        }
    };

    const handleUnexpectedClose = async () => {
        if (stoppedByUser || state === "ended") return;
        if (reconnectTimer) return;
        if (reconnectAttempts >= reconnect.maxAttempts) {
            emit({ type: "error", code: "REALTIME_SESSION_UNAVAILABLE", message: realTimeErrorMessage("REALTIME_SESSION_UNAVAILABLE"), retryable: true });
            state = "error";
            detachTransport();
            return;
        }
        reconnectAttempts += 1;
        emit({ type: "reconnecting", attempt: reconnectAttempts });
        state = "reconnecting";
        detachTransport();
        const delayMs = Math.min(MAX_RECONNECT_DELAY_MS, reconnect.baseDelayMs * (2 ** (reconnectAttempts - 1)));
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            void (async () => {
                try {
                    await openSession();
                    if (state === "reconnecting") {
                        emit({ type: "reconnected" });
                    }
                } catch (error) {
                    if (!(error instanceof MirrorRealtimeError) || error.retryable) {
                        if (!reconnectTimer && !stoppedByUser) void handleUnexpectedClose();
                    } else {
                        emit({ type: "error", code: error.code, message: error.message, retryable: false });
                        state = "error";
                    }
                }
            })();
        }, delayMs);
    };

    const interrupt = () => {
        if (state !== "assistantSpeaking" && state !== "thinking") return;
        send(protocol?.build({ type: "cancelResponse" }) ?? []);
        requireAudio().interruptPlayback();
        assistantText = "";
        state = state === "thinking" ? "userSpeaking" : "listening";
        emit({ type: "assistantInterrupted" });
    };

    const stop = async () => {
        if (state === "idle" || state === "ended" || state === "ending") return;
        stoppedByUser = true;
        state = "ending";
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        try {
            requireAudio().interruptPlayback();
        } catch {
            // Audio is only resolved once start has begun.
        }
        await stopCaptureAndPlayback();
        try {
            await transport?.close();
        } catch {
            // The provider may already be gone.
        }
        detachTransport();
        captureStarted = false;
        activeSpec = null;
        protocol = null;
        transport = null;
        assistantText = "";
        userTranscript = "";
        state = "ended";
        emit({ type: "sessionEnded" });
        try {
            requireAudio().cleanup();
        } catch {
            // Native teardown failure at this point is irrelevant.
        }
    };

    const dispose = () => {
        stoppedByUser = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        detachTransport();
        listeners.clear();
        try {
            audio?.cleanup();
        } catch {
            // Already disposed.
        }
    };

    return {
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        get active() {
            return state !== "idle" && state !== "ended";
        },
        start,
        interrupt,
        stop,
        dispose,
    };
}