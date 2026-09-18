import { describe, expect, it } from "vitest";
import { OpenAIRealtimeProtocol, assertRealtimeSessionUpdatable } from "./openai-realtime.protocol";
import type { RealtimeEvent, RealtimeSessionSpec } from "../types";
import { MirrorRealtimeError } from "../types";

const spec: RealtimeSessionSpec = {
    conversationId: null,
    provider: "openai",
    protocol: "openai-realtime",
    transport: "websocket",
    endpoint: "wss://api.openai.com/v1/realtime?model=gpt-realtime",
    sessionToken: "ephemeral-token",
    tokenExpiresAt: null,
    model: "gpt-realtime",
    instructions: "You are Aks, a warm and present companion.",
    inputSampleRate: 24000,
    outputSampleRate: 24000,
    pcmFormat: "pcm16",
};

function emit(protocol: OpenAIRealtimeProtocol, raw: Record<string, unknown>): RealtimeEvent[] {
    return protocol.parse({ type: raw.type, ...raw });
}

describe("OpenAI realtime protocol", () => {
    it("builds the session.update command from the spec on sessionStart", () => {
        const protocol = new OpenAIRealtimeProtocol(spec);
        const [command] = protocol.build({ type: "sessionStart" }) as [{
        type: string;
        session: {
            model: string;
            instructions: string;
            modalities: string[];
            voice: string;
            input_audio_format: string;
            output_audio_format: string;
            input_audio_transcription: { model: string };
            turn_detection: { type: string };
        };
    }];
        expect(command.type).toBe("session.update");
        expect(command.session.model).toBe(spec.model);
        expect(command.session.instructions).toBe(spec.instructions);
        expect(command.session.modalities).toEqual(["text", "audio"]);
        expect(command.session.voice).toBe("alloy");
        expect(command.session.input_audio_format).toBe("pcm16");
        expect(command.session.output_audio_format).toBe("pcm16");
        expect(command.session.input_audio_transcription).toEqual({ model: "whisper-1" });
        expect(command.session.turn_detection.type).toBe("server_vad");
    });

    it("builds userText as a conversation item plus response.create", () => {
        const protocol = new OpenAIRealtimeProtocol(spec);
        const commands = protocol.build({ type: "userText", text: "Hello" });
        expect(commands).toEqual([
            {
                type: "conversation.item.create",
                item: { type: "message", role: "user", content: [{ type: "input_text", text: "Hello" }] },
            },
            { type: "response.create" },
        ]);
    });

    it("builds audio frames, commits and cancels", () => {
        const protocol = new OpenAIRealtimeProtocol(spec);
        expect(protocol.build({ type: "userAudioFrame", pcmBase64: "ABC" })).toEqual([{ type: "input_audio_buffer.append", audio: "ABC" }]);
        expect(protocol.build({ type: "commitInput" })).toEqual([{ type: "input_audio_buffer.commit" }]);
        expect(protocol.build({ type: "cancelResponse" })).toEqual([{ type: "response.cancel" }]);
    });

    it("maps session.created to sessionReady", () => {
        const events = emit(new OpenAIRealtimeProtocol(spec), { type: "session.created" });
        expect(events).toEqual([{ type: "sessionReady" }]);
    });

    it("maps speech started/stopped lifecycle", () => {
        const protocol = new OpenAIRealtimeProtocol(spec);
        expect(emit(protocol, { type: "input_audio_buffer.speech_started" })).toEqual([{ type: "userSpeechStarted" }]);
        expect(emit(protocol, { type: "input_audio_buffer.speech_stopped" })).toEqual([]);
        expect(emit(protocol, { type: "input_audio_buffer.committed" })).toEqual([]);
    });

    it("maps transcription completed only for non-empty transcripts", () => {
        const protocol = new OpenAIRealtimeProtocol(spec);
        expect(emit(protocol, { type: "conversation.item.input_audio_transcription.completed", transcript: "Hello" })).toEqual([{ type: "userTranscriptFinal", transcript: "Hello" }]);
        expect(emit(protocol, { type: "conversation.item.input_audio_transcription.completed", transcript: "" })).toEqual([]);
    });

    it("maps transcription failure to a non-retryable error", () => {
        const events = emit(new OpenAIRealtimeProtocol(spec), { type: "conversation.item.input_audio_transcription.failed" });
        expect(events).toEqual([{ type: "error", code: "REALTIME_TRANSCRIPTION_FAILED", retryable: false, message: expect.any(String) }]);
    });

    it("emits assistantStarted once then streams audio chunks", () => {
        const protocol = new OpenAIRealtimeProtocol(spec);
        expect(emit(protocol, { type: "response.created" })).toEqual([{ type: "assistantResponseStarted" }]);
        expect(emit(protocol, { type: "response.output_audio.delta", audio: "AAA" })).toEqual([
            { type: "assistantAudioStarted" },
            { type: "assistantAudioChunk", pcmBase64: "AAA" },
        ]);
        expect(emit(protocol, { type: "response.output_audio.delta", audio: "BBB" })).toEqual([{ type: "assistantAudioChunk", pcmBase64: "BBB" }]);
        expect(emit(protocol, { type: "response.output_audio.done" })).toEqual([{ type: "assistantAudioFinished" }]);
    });

    it("ignores output_text deltas so the audio transcript stays single source", () => {
        const protocol = new OpenAIRealtimeProtocol(spec);
        expect(emit(protocol, { type: "response.output_text.delta" })).toEqual([]);
        expect(emit(protocol, { type: "response.output_text.done" })).toEqual([]);
        expect(emit(protocol, { type: "response.output_audio_transcript.delta" })).toEqual([]);
        expect(emit(protocol, { type: "response.output_audio_transcript.done" })).toEqual([{ type: "assistantTextFinal", text: "" }]);
    });

    it("maps response done to turnCompleted and cancels to interrupted", () => {
        const protocol = new OpenAIRealtimeProtocol(spec);
        emit(protocol, { type: "response.created" });
        expect(emit(protocol, { type: "response.done" })).toEqual([{ type: "turnCompleted" }]);
        emit(protocol, { type: "response.created" });
        expect(emit(protocol, { type: "response.cancelled" })).toEqual([{ type: "assistantInterrupted" }]);
    });

    it("maps session_expired to a retryable error", () => {
        const events = emit(new OpenAIRealtimeProtocol(spec), { type: "error", error: { type: "session_expired", message: "expired" } });
        expect(events).toEqual([{ type: "error", code: "REALTIME_SESSION_EXPIRED", retryable: true, message: expect.any(String) }]);
    });

    it("maps invalid_request_error to a non-retryable provider error", () => {
        const events = emit(new OpenAIRealtimeProtocol(spec), { type: "error", error: { type: "invalid_request_error", message: "bad request" } });
        expect(events[0]).toMatchObject({ type: "error", code: "REALTIME_PROVIDER_ERROR", retryable: false, message: "bad request" });
    });

    it("maps generic errors to retryable provider errors and ignores unknown events", () => {
        const protocol = new OpenAIRealtimeProtocol(spec);
        expect(emit(protocol, { type: "weird.delta" })).toEqual([]);
        const events = emit(protocol, { type: "error", error: { message: "boom" } });
        expect(events[0]).toMatchObject({ type: "error", code: "REALTIME_PROVIDER_ERROR", retryable: true, message: "boom" });
    });

    it("rejects non-pcm16 formats for the OpenAI provider", () => {
        expect(() =>
            assertRealtimeSessionUpdatable(new OpenAIRealtimeProtocol(spec), { ...spec, pcmFormat: "pcm24" as unknown as RealtimeSessionSpec["pcmFormat"] }),
        ).toThrow(MirrorRealtimeError);
    });
});