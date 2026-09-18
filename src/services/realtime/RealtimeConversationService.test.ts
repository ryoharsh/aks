import { describe, expect, it, vi } from "vitest";
import { createRealtimeConversationSession } from "./RealtimeConversationService";
import type {
    RealtimeAudioHardware,
    RealtimeEvent,
    RealtimeProtocolCommand,
    RealtimeSessionProtocol,
    RealtimeSessionRequest,
    RealtimeSessionSpec,
    RealtimeTransport,
    RealtimeTransportCloseInfo,
} from "./types";
import { MirrorRealtimeError } from "./types";

const spec: RealtimeSessionSpec = {
    conversationId: "conversation-1",
    provider: "openai",
    protocol: "openai-realtime",
    transport: "websocket",
    endpoint: "wss://api.openai.com/v1/realtime",
    sessionToken: "ephemeral-token",
    tokenExpiresAt: null,
    model: "gpt-realtime",
    instructions: "You are Aks.",
    inputSampleRate: 24000,
    outputSampleRate: 24000,
    pcmFormat: "pcm16",
};

class FakeTransport implements RealtimeTransport {
    readonly kind: "websocket" = "websocket";
    connect = vi.fn(async () => undefined);
    send = vi.fn();
    close = vi.fn(async () => undefined);
    onMessage = vi.fn((listener: (raw: unknown) => void) => {
        this.messageListener = listener;
        return () => undefined;
    });
    onClose = vi.fn((listener: (info: RealtimeTransportCloseInfo) => void) => {
        this.closeListener = listener;
        return () => undefined;
    });
    onError = vi.fn((listener: (error: Error) => void) => {
        this.errorListener = listener;
        return () => undefined;
    });
    messageListener: ((raw: unknown) => void) | null = null;
    closeListener: ((info: RealtimeTransportCloseInfo) => void) | null = null;
    errorListener: ((error: Error) => void) | null = null;

    receive(raw: unknown) {
        this.messageListener?.(raw);
    }
    closeFromServer(code: number, wasClean: boolean) {
        this.closeListener?.({ code, reason: "", wasClean });
    }
}

function createAudio(overrides: Partial<RealtimeAudioHardware> = {}): RealtimeAudioHardware {
    return {
        support: { supported: true, engine: "native" },
        requestMicPermission: vi.fn(async () => "granted" as const),
        startCapture: vi.fn(async () => undefined),
        stopCapture: vi.fn(async () => undefined),
        startPlayback: vi.fn(async () => undefined),
        enqueuePcm: vi.fn(),
        flushPlayback: vi.fn(async () => undefined),
        stopPlayback: vi.fn(async () => undefined),
        interruptPlayback: vi.fn(),
        cleanup: vi.fn(),
        ...overrides,
    } as RealtimeAudioHardware;
}

function createHarness() {
    const emitted: RealtimeEvent[] = [];
    const audio = createAudio();
    const adapter = {
        createSession: vi.fn<(request: RealtimeSessionRequest) => Promise<RealtimeSessionSpec>>(async () => spec),
    };
    const protocol = {
        id: "test-protocol",
        parse: vi.fn<(raw: unknown) => RealtimeEvent[]>(() => []),
        build: vi.fn<(command: RealtimeProtocolCommand) => unknown[]>((command) => [{ __command: command.type }]),
    } satisfies RealtimeSessionProtocol;
    const transports: FakeTransport[] = [];
    const session = createRealtimeConversationSession({
        getConversationId: () => "conversation-1",
        adapter,
        getAudio: async () => audio,
        onEvent: (event) => emitted.push(event),
        createProtocol: () => protocol,
        createTransport: () => {
            const transport = new FakeTransport();
            transports.push(transport);
            return transport;
        },
        reconnect: { maxAttempts: 2, baseDelayMs: 1 },
    });
    return { emitted, audio, adapter, protocol, session, transports };
}

function lastEvent(emitted: RealtimeEvent[]): RealtimeEvent {
    return emitted[emitted.length - 1]!;
}

function eventsOfType(emitted: RealtimeEvent[], type: RealtimeEvent["type"]): RealtimeEvent[] {
    return emitted.filter((event) => event.type === type);
}

describe("RealtimeConversationService", () => {
    it("connects end to end: mic permission, transport, session.update, playback", async () => {
        const { emitted, audio, adapter, protocol, session, transports } = createHarness();

        await session.start();

        expect(emitted[0]).toEqual({ type: "sessionConnecting" });
        expect(adapter.createSession).toHaveBeenCalledWith({ conversationId: "conversation-1" });
        expect(protocol.build).toHaveBeenCalledWith({ type: "sessionStart" });
        expect(transports[0].connect).toHaveBeenCalledWith(spec);
        expect(transports[0].send).toHaveBeenCalledWith({ __command: "sessionStart" });
        expect(audio.requestMicPermission).toHaveBeenCalledOnce();
        expect(audio.startPlayback).toHaveBeenCalledWith(spec.outputSampleRate);
        expect(session.active).toBe(true);
    });

    it("runs a full voice turn and emits the live transcript + audio", async () => {
        const { emitted, audio, protocol, session, transports } = createHarness();
        await session.start();

        protocol.parse.mockReturnValueOnce([{ type: "sessionReady" }, { type: "listening" }]);
        transports[0].receive({ type: "session.created" });
        expect(emitted).toContainEqual({ type: "sessionReady" });
        expect(emitted).toContainEqual({ type: "listening" });
        await vi.waitFor(() => expect(audio.startCapture).toHaveBeenCalledWith(spec.inputSampleRate, expect.any(Function), expect.any(Function)));

        protocol.parse.mockReturnValueOnce([
            { type: "userSpeechStarted" },
            { type: "userTranscriptDelta", transcript: "Hel" },
            { type: "userTranscriptDelta", transcript: "Hello" },
            { type: "userTranscriptFinal", transcript: "Hello" },
        ]);
        transports[0].receive({ type: "input_audio_buffer.speech_started" });
        expect(emitted).toContainEqual({ type: "userSpeechStarted" });
        expect(emitted).toContainEqual({ type: "userTranscriptFinal", transcript: "Hello" });

        protocol.parse.mockReturnValueOnce([
            { type: "assistantResponseStarted" },
            { type: "assistantTextDelta", text: "Hi " },
            { type: "assistantTextDelta", text: "friend" },
            { type: "assistantAudioStarted" },
            { type: "assistantAudioChunk", pcmBase64: "AAAA" },
            { type: "assistantAudioChunk", pcmBase64: "BBBB" },
        ]);
        transports[0].receive({ type: "response.created" });
        expect(eventsOfType(emitted, "assistantTextDelta")).toEqual([
            { type: "assistantTextDelta", text: "Hi " },
            { type: "assistantTextDelta", text: "friend" },
        ]);
        expect(audio.enqueuePcm).toHaveBeenNthCalledWith(1, "AAAA", spec.outputSampleRate);
        expect(audio.enqueuePcm).toHaveBeenNthCalledWith(2, "BBBB", spec.outputSampleRate);

        protocol.parse.mockReturnValueOnce([{ type: "assistantTextFinal", text: "" }]);
        transports[0].receive({ type: "response.output_audio_transcript.done" });
        expect(lastEvent(emitted)).toEqual({ type: "assistantTextFinal", text: "Hi friend" });

        protocol.parse.mockReturnValueOnce([{ type: "assistantAudioFinished" }, { type: "turnCompleted" }]);
        transports[0].receive({ type: "response.output_audio.done" });
        expect(audio.flushPlayback).toHaveBeenCalledOnce();
        expect(emitted).toContainEqual({ type: "turnCompleted" });
    });

    it("barges in during assistant speech: sends response.cancel, interrupts audio, clears text", async () => {
        const { emitted, audio, protocol, session, transports } = createHarness();
        await session.start();
        protocol.parse.mockReturnValueOnce([{ type: "listening" }]);
        transports[0].receive({});
        await vi.waitFor(() => expect(audio.startCapture).toHaveBeenCalled());

        protocol.parse.mockReturnValueOnce([{ type: "assistantResponseStarted" }, { type: "assistantTextDelta", text: "Let me " }, { type: "assistantAudioStarted" }]);
        transports[0].receive({});
        protocol.build.mockClear();

        protocol.parse.mockReturnValueOnce([{ type: "userSpeechStarted" }]);
        transports[0].receive({});
        expect(protocol.build).toHaveBeenCalledWith({ type: "cancelResponse" });
        expect(audio.interruptPlayback).toHaveBeenCalledOnce();
        expect(emitted).toContainEqual({ type: "assistantInterrupted" });
        expect(emitted[emitted.length - 1]).toEqual({ type: "userSpeechStarted" });
    });

    it("rejects start when the native audio engine is missing", async () => {
        const { audio, session } = createHarness();
        Object.assign(audio, createAudio({ support: { supported: false, engine: "none", reason: "no module" } }));
        await expect(session.start()).rejects.toMatchObject({ code: "REALTIME_AUDIO_UNAVAILABLE", retryable: false });
        expect(audio.requestMicPermission).not.toHaveBeenCalled();
    });

    it("rejects start when mic permission is denied", async () => {
        const { audio, session } = createHarness();
        Object.assign(audio, createAudio({ requestMicPermission: vi.fn(async () => "denied" as const) }));
        await expect(session.start()).rejects.toMatchObject({ code: "REALTIME_MIC_PERMISSION_DENIED", retryable: false });
        expect(audio.stopCapture).toHaveBeenCalled();
        expect(audio.stopPlayback).toHaveBeenCalled();
    });

    it("reconnects after an unexpected close and resumes listening", async () => {
        const { emitted, adapter, session, transports } = createHarness();
        await session.start();

        transports[0].closeFromServer(1006, false);
        await vi.waitFor(() => expect(eventsOfType(emitted, "reconnecting")).toHaveLength(1));
        await vi.waitFor(() => expect(adapter.createSession).toHaveBeenCalledTimes(2));

        expect(transports).toHaveLength(2);
        await vi.waitFor(() => expect(emitted).toContainEqual({ type: "reconnected" }));
        expect(eventsOfType(emitted, "error")).toHaveLength(0);
    });

    it("gives up and reports once reconnects keep failing", async () => {
        const { emitted, adapter, session, transports } = createHarness();
        adapter.createSession
            .mockResolvedValueOnce(spec)
            .mockRejectedValueOnce(new Error("provider down"))
            .mockRejectedValueOnce(new Error("provider down"));

        await session.start();
        transports[0].closeFromServer(1006, false);

        await vi.waitFor(() => expect(emitted.some((event) => event.type === "reconnecting")).toBe(true));
        await vi.waitFor(() =>
            expect(emitted.some((event) => event.type === "error" && event.code === "REALTIME_SESSION_UNAVAILABLE")).toBe(true),
        );
        const failure = emitted.find((event) => event.type === "error" && event.code === "REALTIME_SESSION_UNAVAILABLE");
        expect(failure).toMatchObject({ retryable: true });
    });

    it("surfaces provider session errors through subscribers and onEvent", async () => {
        const { emitted, protocol, session, transports } = createHarness();
        await session.start();
        protocol.parse.mockReturnValueOnce([{ type: "error", code: "REALTIME_SESSION_EXPIRED", message: "expired", retryable: true }]);
        transports[0].receive({});
        expect(emitted.some((event) => event.type === "error" && event.code === "REALTIME_SESSION_EXPIRED" && event.retryable === true)).toBe(true);
    });

    it("stops cleanly: drains capture/playback, closes transport, emits sessionEnded", async () => {
        const { emitted, audio, session, transports } = createHarness();
        await session.start();
        await session.stop();

        expect(audio.interruptPlayback).toHaveBeenCalledOnce();
        expect(audio.stopCapture).toHaveBeenCalledOnce();
        expect(audio.stopPlayback).toHaveBeenCalledOnce();
        expect(transports[0].close).toHaveBeenCalledOnce();
        expect(audio.cleanup).toHaveBeenCalledOnce();
        expect(lastEvent(emitted)).toEqual({ type: "sessionEnded" });
        expect(session.active).toBe(false);
    });

    it("stop() is a no-op before start and emits no events", async () => {
        const { emitted, session } = createHarness();
        await session.stop();
        expect(emitted).toHaveLength(0);
        expect(session.active).toBe(false);
    });

    it("is a MirrorRealtimeError when the adapter fails during start", async () => {
        const { adapter, emitted, session } = createHarness();
        adapter.createSession.mockRejectedValueOnce(new MirrorRealtimeError("REALTIME_NOT_CONFIGURED", false, "not configured"));
        await expect(session.start()).rejects.toMatchObject({ code: "REALTIME_NOT_CONFIGURED" });
        expect(emitted.some((event) => event.type === "error" && event.code === "REALTIME_NOT_CONFIGURED" && event.retryable === false)).toBe(true);
    });
});