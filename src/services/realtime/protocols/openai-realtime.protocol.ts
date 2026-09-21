import type { RealtimeEvent, RealtimeProtocolCommand, RealtimeSessionProtocol, RealtimeSessionSpec } from "../types";
import { MirrorRealtimeError } from "../types";

type WireEvent = { type: string; [key: string]: unknown };

const SESSION_DEFAULTS = {
    modalities: ["text", "audio"],
    voice: "alloy",
    input_audio_format: "pcm16",
    output_audio_format: "pcm16",
    temperature: 0.6,
    input_audio_transcription: { model: "whisper-1" },
    turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 600,
    },
    tools: [],
} as const;

function isWireEvent(value: unknown): value is WireEvent {
    return Boolean(value) && typeof value === "object" && typeof (value as { type?: unknown }).type === "string";
}

/**
 * Maps the OpenAI Realtime API wire protocol (WebSocket) to the normalized
 * Aks Realtime event contract. Assistant text is sourced exclusively from
 * `response.output_audio_transcript.*` so enabling both text and audio
 * modalities cannot produce duplicated bubbles.
 */
export class OpenAIRealtimeProtocol implements RealtimeSessionProtocol {
    readonly id = "openai-realtime";

    private responseInFlight = false;
    private audioStartedForResponse = false;

    constructor(private readonly spec: RealtimeSessionSpec) {}

    reset() {
        this.responseInFlight = false;
        this.audioStartedForResponse = false;
    }

    build(command: RealtimeProtocolCommand): unknown[] {
        switch (command.type) {
            case "sessionStart":
                // Voice and transcription come from the server-issued spec
                // (AI_TTS_MODEL / AI_STT_MODEL); the literals below are only
                // the fallback for specs minted before selection existed.
                return [{
                    type: "session.update",
                    session: {
                        ...SESSION_DEFAULTS,
                        instructions: this.spec.instructions,
                        model: this.spec.model,
                        voice: this.spec.voice ?? SESSION_DEFAULTS.voice,
                        input_audio_transcription: { model: this.spec.transcriptionModel ?? SESSION_DEFAULTS.input_audio_transcription.model },
                        turn_detection: SESSION_DEFAULTS.turn_detection,
                    },
                }];
            case "userText":
                return [
                    {
                        type: "conversation.item.create",
                        item: {
                            type: "message",
                            role: "user",
                            content: [{ type: "input_text", text: command.text }],
                        },
                    },
                    { type: "response.create" },
                ];
            case "userAudioFrame":
                return [{ type: "input_audio_buffer.append", audio: command.pcmBase64 }];
            case "commitInput":
                return [{ type: "input_audio_buffer.commit" }];
            case "cancelResponse":
                return [{ type: "response.cancel" }];
        }
    }

    parse(raw: unknown): RealtimeEvent[] {
        if (!isWireEvent(raw)) return [];
        switch (raw.type) {
            case "session.created":
            case "session.updated":
                this.responseInFlight = false;
                return [{ type: "sessionReady" }];
            case "input_audio_buffer.speech_started":
                return [{ type: "userSpeechStarted" }];
            case "input_audio_buffer.speech_stopped":
            case "input_audio_buffer.committed":
            case "input_audio_buffer.cleared":
            case "conversation.item.created":
            case "response.content_part.added":
            case "response.content_part.done":
            case "response.output_item.added":
            case "response.output_item.done":
            case "response.output_audio_transcript.delta":
                return [];
            case "conversation.item.input_audio_transcription.completed": {
                const transcript = typeof raw.transcript === "string" ? raw.transcript : "";
                return transcript ? [{ type: "userTranscriptFinal", transcript }] : [];
            }
            case "conversation.item.input_audio_transcription.failed":
                return [{ type: "error", code: "REALTIME_TRANSCRIPTION_FAILED", message: "Aks couldn’t make out what you said.", retryable: false }];
            case "response.created":
                this.responseInFlight = true;
                this.audioStartedForResponse = false;
                return [{ type: "assistantResponseStarted" }];
            case "response.output_text.delta":
            case "response.output_text.done":
                // The audio transcript is the single source for assistant text.
                return [];
            case "response.output_audio.delta": {
                const audio = typeof raw.audio === "string" ? raw.audio : "";
                if (!audio) return [];
                const events: RealtimeEvent[] = [];
                if (!this.audioStartedForResponse) {
                    this.audioStartedForResponse = true;
                    events.push({ type: "assistantAudioStarted" });
                }
                events.push({ type: "assistantAudioChunk", pcmBase64: audio });
                return events;
            }
            case "response.output_audio.done":
                return [{ type: "assistantAudioFinished" }];
            case "response.output_audio_transcript.done":
                return [{ type: "assistantTextFinal", text: "" }];
            case "response.created_snapshot":
            case "response.cancelled":
                this.responseInFlight = false;
                this.audioStartedForResponse = false;
                return [{ type: "assistantInterrupted" }];
            case "response.done":
                this.responseInFlight = false;
                this.audioStartedForResponse = false;
                return [{ type: "turnCompleted" }];
            case "error": {
                const wire = raw.error;
                const errorCode = wire && typeof wire === "object" ? String((wire as { code?: unknown }).code ?? "") : "";
                const errorType = wire && typeof wire === "object" ? String((wire as { type?: unknown }).type ?? "") : "";
                const message = wire && typeof wire === "object" && typeof (wire as { message?: unknown }).message === "string"
                    ? (wire as { message: string }).message
                    : "The voice conversation failed.";
                if (errorCode === "session_expired" || errorType === "session_expired") {
                    return [{ type: "error", code: "REALTIME_SESSION_EXPIRED", message: "The voice conversation expired.", retryable: true }];
                }
                const retryable = errorType !== "invalid_request_error" && errorCode !== "invalid_request_error";
                return [{ type: "error", code: "REALTIME_PROVIDER_ERROR", message: message || "The voice conversation failed.", retryable }];
            }
            default:
                return [];
        }
    }
}

export function assertRealtimeSessionUpdatable(protocol: RealtimeSessionProtocol, spec: RealtimeSessionSpec): void {
    if (protocol.id === "openai-realtime" && spec.pcmFormat !== "pcm16") {
        throw new MirrorRealtimeError("REALTIME_TRANSPORT_UNAVAILABLE", false, "This provider only supports pcm16 audio.");
    }
}