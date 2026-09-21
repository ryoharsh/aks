import type { RealtimeEvent, RealtimeProtocolCommand, RealtimeSessionProtocol, RealtimeSessionSpec } from "../types";
import { MirrorRealtimeError } from "../types";

type WireMessage = { type?: unknown; [key: string]: unknown };

function isWireMessage(value: unknown): value is WireMessage {
    return Boolean(value) && typeof value === "object";
}

function asText(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Maps the Sarvam pipeline wire dialect to the normalized Aks Realtime event
 * contract — the same RealtimeEvent union the OpenAI protocol speaks, so the
 * session service, useMirror, and the UI behave identically no matter which
 * provider minted the session.
 *
 * Pipeline (all Sarvam-specific details stay in this file): realtime Sarvam
 * STT frames arrive on the session socket; the server forwards each final
 * transcript through the EXISTING Aks LLM pipeline (no separate LLM, no
 * separate realtime model) and streams Sarvam TTS audio back on the same
 * socket. User interruption stops TTS immediately: an STT barge-in makes
 * the session service send `tts.stop` (built below), interrupt local
 * playback, and emit the shared `assistantInterrupted` event.
 */
export class SarvamPipelineProtocol implements RealtimeSessionProtocol {
    readonly id = "sarvam-pipeline";

    private responseInFlight = false;
    private audioStartedForResponse = false;
    private speechAnnouncedForTurn = false;

    constructor(private readonly spec: RealtimeSessionSpec) {}

    reset() {
        this.responseInFlight = false;
        this.audioStartedForResponse = false;
        this.speechAnnouncedForTurn = false;
    }

    build(command: RealtimeProtocolCommand): unknown[] {
        switch (command.type) {
            case "sessionStart":
                return [{
                    type: "session.start",
                    sttModel: this.spec.transcriptionModel ?? "saarika:v2.5",
                    ttsVoice: this.spec.voice ?? "bulbul:v2",
                    instructions: this.spec.instructions,
                    inputFormat: "pcm16",
                    sampleRate: this.spec.inputSampleRate,
                }];
            case "userText":
                // A typed turn runs the same pipeline: existing Aks LLM, then
                // streamed Sarvam TTS back over this socket.
                return [{ type: "text.turn", text: command.text }];
            case "userAudioFrame":
                return [{ type: "stt.audio", audio: command.pcmBase64 }];
            case "commitInput":
                return [{ type: "stt.commit" }];
            case "cancelResponse":
                // User interruption stops TTS immediately, server-side (this
                // frame) and client-side (the session service interrupts
                // local playback when it builds this command).
                return [{ type: "tts.stop" }];
        }
    }

    parse(raw: unknown): RealtimeEvent[] {
        if (!isWireMessage(raw) || typeof raw.type !== "string") return [];
        switch (raw.type) {
            case "session.ready":
                this.responseInFlight = false;
                this.audioStartedForResponse = false;
                this.speechAnnouncedForTurn = false;
                return [{ type: "sessionReady" }, { type: "listening" }];
            case "stt.speech_started": {
                const events: RealtimeEvent[] = [];
                if (!this.speechAnnouncedForTurn) {
                    this.speechAnnouncedForTurn = true;
                    events.push({ type: "userSpeechStarted" });
                }
                return events;
            }
            case "stt.partial": {
                const transcript = asText(raw.transcript);
                if (!transcript) return [];
                const events: RealtimeEvent[] = [];
                if (!this.speechAnnouncedForTurn) {
                    this.speechAnnouncedForTurn = true;
                    events.push({ type: "userSpeechStarted" });
                }
                events.push({ type: "userTranscriptDelta", transcript });
                return events;
            }
            case "stt.final": {
                const transcript = asText(raw.transcript);
                if (!transcript) return [];
                this.speechAnnouncedForTurn = true;
                // The final transcript now flows through the existing Aks LLM.
                return [{ type: "userTranscriptFinal", transcript }, { type: "thinking" }];
            }
            case "stt.failed":
                return [{ type: "error", code: "REALTIME_TRANSCRIPTION_FAILED", message: "Aks couldn’t make out what you said.", retryable: false }];
            case "llm.delta": {
                const text = asText(raw.text);
                if (!text) return [];
                const events: RealtimeEvent[] = [];
                if (!this.responseInFlight) {
                    this.responseInFlight = true;
                    events.push({ type: "assistantResponseStarted" });
                }
                events.push({ type: "assistantTextDelta", text });
                return events;
            }
            case "llm.done":
                return [{ type: "assistantTextFinal", text: "" }];
            case "tts.start":
                if (this.audioStartedForResponse) return [];
                this.audioStartedForResponse = true;
                return [{ type: "assistantAudioStarted" }];
            case "tts.chunk": {
                const audio = asText(raw.audio);
                if (!audio) return [];
                const events: RealtimeEvent[] = [];
                if (!this.audioStartedForResponse) {
                    this.audioStartedForResponse = true;
                    events.push({ type: "assistantAudioStarted" });
                }
                events.push({ type: "assistantAudioChunk", pcmBase64: audio });
                return events;
            }
            case "tts.end":
                return [{ type: "assistantAudioFinished" }];
            case "tts.interrupted":
                this.responseInFlight = false;
                this.audioStartedForResponse = false;
                return [{ type: "assistantInterrupted" }];
            case "turn.complete":
                this.responseInFlight = false;
                this.audioStartedForResponse = false;
                this.speechAnnouncedForTurn = false;
                return [{ type: "turnCompleted" }];
            case "session.expired":
                return [{ type: "error", code: "REALTIME_SESSION_EXPIRED", message: "The voice conversation expired.", retryable: true }];
            case "error": {
                const message = asText(raw.message) ?? "The voice conversation failed.";
                return [{ type: "error", code: "REALTIME_PROVIDER_ERROR", message, retryable: raw.retryable === true }];
            }
            default:
                return [];
        }
    }
}

export function assertSarvamSessionCompatible(spec: RealtimeSessionSpec): void {
    if (spec.protocol !== "sarvam-pipeline") {
        throw new MirrorRealtimeError("REALTIME_TRANSPORT_UNAVAILABLE", false, `The Sarvam adapter cannot serve protocol "${spec.protocol}".`);
    }
    if (spec.pcmFormat !== "pcm16") {
        throw new MirrorRealtimeError("REALTIME_TRANSPORT_UNAVAILABLE", false, "This provider only supports pcm16 audio.");
    }
}
