import { describe, expect, it, vi } from "vitest";

import { createRealtimeConversationSession } from "../RealtimeConversationService";
import { REAL_TIME_EVENT_TYPES, type RealtimeAudioHardware, type RealtimeEvent, type RealtimeProtocolCommand, type RealtimeSessionProtocol, type RealtimeSessionRequest, type RealtimeSessionSpec, type RealtimeTransport, type RealtimeTransportCloseInfo } from "../types";
import { createRealtimeProtocol } from "./realtime.protocol-registry";
import { OpenAIRealtimeProtocol } from "./openai-realtime.protocol";
import { GeminiLiveProtocol } from "./gemini-live.protocol";
import { SarvamPipelineProtocol } from "./sarvam-pipeline.protocol";
import { REQUIRED_VOICE_EVENTS, VOICE_EVENT_MAP, VOICE_PROTOCOL_IDS, isVoiceProtocol } from "../providers/voice-provider";

function baseSpec(protocol: string, provider: string): RealtimeSessionSpec {
    return {
        conversationId: "conversation-1",
        provider,
        protocol,
        transport: "websocket",
        endpoint: "wss://voice.test/session",
        sessionToken: "session-token",
        tokenExpiresAt: null,
        model: "voice-model",
        instructions: "You are Aks.",
        inputSampleRate: 24000,
        outputSampleRate: 24000,
        pcmFormat: "pcm16",
        voice: "test-voice",
        transcriptionModel: "test-transcription",
    };
}

const COMMANDS: RealtimeProtocolCommand[] = [
    { type: "sessionStart" },
    { type: "userText", text: "Hello" },
    { type: "userAudioFrame", pcmBase64: "AAAA" },
    { type: "commitInput" },
    { type: "cancelResponse" },
];

const GARBAGE: unknown[] = [null, undefined, 0, "", "wire", [], {}, { type: 42 }, { type: "unknown.event" }];

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

function createAudio(): RealtimeAudioHardware {
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
    } as RealtimeAudioHardware;
}

/** Full-turn wire scripts per provider dialect. */
const OPENAI_TURN: unknown[] = [
    { type: "session.created" },
    { type: "input_audio_buffer.speech_started" },
    { type: "conversation.item.input_audio_transcription.completed", transcript: "Hello Aks" },
    { type: "response.created" },
    { type: "response.output_audio.delta", audio: "AAAA" },
    { type: "response.output_audio.done" },
    { type: "response.done" },
];

const GEMINI_TURN: unknown[] = [
    { setupComplete: {} },
    { serverContent: { inputTranscription: { text: "Hel", isFinal: false } } },
    { serverContent: { inputTranscription: { text: "Hello Aks", isFinal: true } } },
    { serverContent: { modelTurn: { parts: [{ text: "Hi " }] } } },
    { serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm", data: "AAAA" } }] } } },
    { serverContent: { outputTranscription: { text: "friend", isFinal: false } } },
    { serverContent: { turnComplete: true } },
];

const SARVAM_TURN: unknown[] = [
    { type: "session.ready" },
    { type: "stt.partial", transcript: "Hel" },
    { type: "stt.final", transcript: "Hello Aks" },
    { type: "llm.delta", text: "Hi " },
    { type: "tts.start" },
    { type: "tts.chunk", audio: "AAAA" },
    { type: "tts.end" },
    { type: "llm.done" },
    { type: "turn.complete" },
];

/** Core normalized checkpoints every provider turn must produce through the unchanged service. */
const CORE_TURN_EVENTS = [
    "sessionConnecting",
    "sessionReady",
    "userSpeechStarted",
    "userTranscriptFinal",
    "assistantResponseStarted",
    "assistantAudioStarted",
    "assistantAudioChunk",
    "turnCompleted",
] as const;

async function runTurn(protocolId: string, provider: string, wire: unknown[]) {
    const emitted: RealtimeEvent[] = [];
    const audio = createAudio();
    const spec = baseSpec(protocolId, provider);
    const transports: FakeTransport[] = [];
    const session = createRealtimeConversationSession({
        getConversationId: () => "conversation-1",
        adapter: { createSession: async (_request: RealtimeSessionRequest) => spec },
        getAudio: async () => audio,
        onEvent: (event) => emitted.push(event),
        createProtocol: (active) => createRealtimeProtocol(active),
        createTransport: () => {
            const transport = new FakeTransport();
            transports.push(transport);
            return transport;
        },
        reconnect: { maxAttempts: 2, baseDelayMs: 1 },
    });
    await session.start();
    for (const frame of wire) transports[0]!.receive(frame);
    await session.stop();
    return { emitted, audio, transports };
}

function eventTypes(emitted: RealtimeEvent[]): string[] {
    return emitted.map((event) => event.type);
}

describe("VoiceProvider contract (client)", () => {
    it("registers all 3 protocols; unknown protocols still fail closed", () => {
        expect(createRealtimeProtocol(baseSpec("openai-realtime", "openai"))).toBeInstanceOf(OpenAIRealtimeProtocol);
        expect(createRealtimeProtocol(baseSpec("gemini-live", "gemini"))).toBeInstanceOf(GeminiLiveProtocol);
        expect(createRealtimeProtocol(baseSpec("sarvam-pipeline", "sarvam"))).toBeInstanceOf(SarvamPipelineProtocol);
        expect(() => createRealtimeProtocol(baseSpec("other", "other"))).toThrow("No protocol mapper");
        expect(isVoiceProtocol("openai-realtime")).toBe(true);
        expect(isVoiceProtocol("gemini-live")).toBe(true);
        expect(isVoiceProtocol("sarvam-pipeline")).toBe(true);
        expect(isVoiceProtocol("other")).toBe(false);
        expect([...VOICE_PROTOCOL_IDS]).toEqual(["openai-realtime", "gemini-live", "sarvam-pipeline"]);
    });

    it("maps every required normalized voice event onto the shared RealtimeEvent union", () => {
        expect([...REQUIRED_VOICE_EVENTS]).toEqual([
            "connecting", "connected", "listening", "userSpeaking", "userTranscriptPartial", "userTranscriptFinal",
            "thinking", "assistantTextDelta", "assistantAudio", "assistantSpeaking", "interrupted",
            "reconnecting", "error", "ended",
        ]);
        for (const name of REQUIRED_VOICE_EVENTS) {
            expect(VOICE_EVENT_MAP[name]).toBeDefined();
            expect((REAL_TIME_EVENT_TYPES as readonly string[])).toContain(VOICE_EVENT_MAP[name]);
        }
    });

    it("all 3 protocols implement the full command surface without throwing", () => {
        const protocols: RealtimeSessionProtocol[] = [
            new OpenAIRealtimeProtocol(baseSpec("openai-realtime", "openai")),
            new GeminiLiveProtocol(baseSpec("gemini-live", "gemini")),
            new SarvamPipelineProtocol(baseSpec("sarvam-pipeline", "sarvam")),
        ];
        for (const protocol of protocols) {
            expect(typeof protocol.id).toBe("string");
            for (const command of COMMANDS) {
                const built = protocol.build(command);
                expect(Array.isArray(built)).toBe(true);
            }
            for (const garbage of GARBAGE) {
                expect(() => protocol.parse(garbage)).not.toThrow();
                expect(protocol.parse(garbage)).toEqual([]);
            }
        }
    });

    it("every event each protocol emits belongs to the shared normalized universe", () => {
        const protocols: Array<{ protocol: RealtimeSessionProtocol; frames: unknown[] }> = [
            { protocol: new OpenAIRealtimeProtocol(baseSpec("openai-realtime", "openai")), frames: OPENAI_TURN },
            { protocol: new GeminiLiveProtocol(baseSpec("gemini-live", "gemini")), frames: GEMINI_TURN },
            { protocol: new SarvamPipelineProtocol(baseSpec("sarvam-pipeline", "sarvam")), frames: SARVAM_TURN },
        ];
        for (const { protocol, frames } of protocols) {
            const seen = new Set<string>();
            for (const frame of [...frames, ...GARBAGE]) {
                for (const event of protocol.parse(frame)) {
                    seen.add(event.type);
                    expect((REAL_TIME_EVENT_TYPES as readonly string[])).toContain(event.type);
                }
            }
            // Every dialect covers the core normalized checkpoints.
            for (const required of CORE_TURN_EVENTS) {
                if (required === "sessionConnecting") continue; // emitted by the service, not protocols
                expect(seen.has(required), `${protocol.id} never emits ${required}`).toBe(true);
            }
        }
    });

    it("the app exposes the same normalized turn for all 3 providers end to end", async () => {
        const cases = [
            { id: "openai-realtime", provider: "openai", wire: OPENAI_TURN },
            { id: "gemini-live", provider: "gemini", wire: GEMINI_TURN },
            { id: "sarvam-pipeline", provider: "sarvam", wire: SARVAM_TURN },
        ] as const;
        for (const { id, provider, wire } of cases) {
            const { emitted, audio } = await runTurn(id, provider, [...wire]);
            const types = eventTypes(emitted);
            for (const required of CORE_TURN_EVENTS) {
                expect(types, `${id} turn`).toContain(required);
            }
            expect(types[types.length - 1]).toBe("sessionEnded");
            // Assistant audio always reaches the same playback queue.
            expect(audio.enqueuePcm).toHaveBeenCalledWith("AAAA", 24000);
        }
    });

    it("gemini and sarvam stream the richer normalized events (partials, thinking, text deltas)", async () => {
        for (const { id, provider, wire } of [
            { id: "gemini-live", provider: "gemini", wire: GEMINI_TURN },
            { id: "sarvam-pipeline", provider: "sarvam", wire: SARVAM_TURN },
        ] as const) {
            const { emitted } = await runTurn(id, provider, [...wire]);
            const types = eventTypes(emitted);
            expect(types, `${id} partials`).toContain("userTranscriptDelta");
            expect(types, `${id} thinking`).toContain("thinking");
            expect(types, `${id} text deltas`).toContain("assistantTextDelta");
            expect(types, `${id} listening`).toContain("listening");
            expect(types, `${id} audio finished`).toContain("assistantAudioFinished");
        }
    });

    it("user interruption stops TTS immediately on the sarvam pipeline", async () => {
        const emitted: RealtimeEvent[] = [];
        const audio = createAudio();
        const spec = baseSpec("sarvam-pipeline", "sarvam");
        const transports: FakeTransport[] = [];
        const session = createRealtimeConversationSession({
            getConversationId: () => "conversation-1",
            adapter: { createSession: async () => spec },
            getAudio: async () => audio,
            onEvent: (event) => emitted.push(event),
            createProtocol: (active) => createRealtimeProtocol(active),
            createTransport: () => {
                const transport = new FakeTransport();
                transports.push(transport);
                return transport;
            },
            reconnect: { maxAttempts: 2, baseDelayMs: 1 },
        });
        await session.start();
        transports[0]!.receive({ type: "session.ready" });
        await vi.waitFor(() => expect(audio.startCapture).toHaveBeenCalled());
        transports[0]!.receive({ type: "llm.delta", text: "Let me " });
        transports[0]!.receive({ type: "tts.chunk", audio: "AAAA" });
        transports[0]!.send.mockClear();

        // Barge-in while the assistant speaks: the pipeline is told to stop
        // TTS at once, local playback is interrupted, one normalized event.
        transports[0]!.receive({ type: "stt.speech_started" });
        expect(transports[0]!.send).toHaveBeenCalledWith({ type: "tts.stop" });
        expect(audio.interruptPlayback).toHaveBeenCalled();
        expect(eventTypes(emitted)).toContain("assistantInterrupted");
        expect(emitted[emitted.length - 1]).toEqual({ type: "userSpeechStarted" });
        await session.stop();
    });

    it("gemini barge-in interrupts playback through the same normalized event", async () => {
        const emitted: RealtimeEvent[] = [];
        const audio = createAudio();
        const spec = baseSpec("gemini-live", "gemini");
        const transports: FakeTransport[] = [];
        const session = createRealtimeConversationSession({
            getConversationId: () => "conversation-1",
            adapter: { createSession: async () => spec },
            getAudio: async () => audio,
            onEvent: (event) => emitted.push(event),
            createProtocol: (active) => createRealtimeProtocol(active),
            createTransport: () => {
                const transport = new FakeTransport();
                transports.push(transport);
                return transport;
            },
            reconnect: { maxAttempts: 2, baseDelayMs: 1 },
        });
        await session.start();
        transports[0]!.receive({ setupComplete: {} });
        await vi.waitFor(() => expect(audio.startCapture).toHaveBeenCalled());
        transports[0]!.receive({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm", data: "AAAA" } }] } } });
        transports[0]!.receive({ serverContent: { inputTranscription: { text: "Wait", isFinal: false } } });
        expect(audio.interruptPlayback).toHaveBeenCalled();
        expect(eventTypes(emitted)).toContain("assistantInterrupted");
        await session.stop();
    });

    it("provider errors map onto the same normalized error event for every dialect", () => {
        const openai = new OpenAIRealtimeProtocol(baseSpec("openai-realtime", "openai"));
        const gemini = new GeminiLiveProtocol(baseSpec("gemini-live", "gemini"));
        const sarvam = new SarvamPipelineProtocol(baseSpec("sarvam-pipeline", "sarvam"));
        expect(openai.parse({ type: "conversation.item.input_audio_transcription.failed" })[0]).toMatchObject({ type: "error", retryable: false });
        expect(sarvam.parse({ type: "stt.failed" })[0]).toMatchObject({ type: "error", code: "REALTIME_TRANSCRIPTION_FAILED", retryable: false });
        expect(gemini.parse({ error: { message: "boom" } })[0]).toMatchObject({ type: "error", code: "REALTIME_PROVIDER_ERROR", retryable: true });
        expect(sarvam.parse({ type: "session.expired" })[0]).toMatchObject({ type: "error", code: "REALTIME_SESSION_EXPIRED", retryable: true });
    });
});
