import type { RealtimeEvent } from "../types";

/**
 * Provider-neutral VoiceProvider contract (client side).
 *
 * Every voice provider — OpenAI Realtime, Gemini Live, Sarvam pipeline —
 * speaks the same normalized event language: the shared RealtimeEvent
 * union. The session service (`RealtimeConversationService`), `useMirror`,
 * and `AiConversationScreen` therefore behave identically no matter which
 * provider minted the session; only the protocol mappers
 * (`protocols/*.protocol.ts`) know vendor wire details.
 *
 * Normalized voice events exposed identically by all 3 providers, and the
 * RealtimeEvent they arrive as:
 *
 *   connecting          -> sessionConnecting
 *   connected           -> sessionReady
 *   listening           -> listening
 *   userSpeaking        -> userSpeechStarted
 *   userTranscriptPartial -> userTranscriptDelta
 *   userTranscriptFinal -> userTranscriptFinal
 *   thinking            -> thinking
 *   assistantTextDelta  -> assistantTextDelta
 *   assistantAudio      -> assistantAudioChunk
 *   assistantSpeaking   -> assistantResponseStarted (+ assistantAudioStarted
 *                          as the audio-playback companion)
 *   interrupted         -> assistantInterrupted
 *   reconnecting        -> reconnecting
 *   error               -> error
 *   ended               -> sessionEnded
 *
 * Transport-lifecycle companions emitted by the session service itself
 * (identical for every provider): `reconnected`, `turnCompleted`,
 * `assistantAudioFinished`, `assistantTextFinal`.
 */

export const VOICE_PROTOCOL_IDS = ["openai-realtime", "gemini-live", "sarvam-pipeline"] as const;
export type VoiceProtocolId = (typeof VOICE_PROTOCOL_IDS)[number];

export const REQUIRED_VOICE_EVENTS = [
    "connecting",
    "connected",
    "listening",
    "userSpeaking",
    "userTranscriptPartial",
    "userTranscriptFinal",
    "thinking",
    "assistantTextDelta",
    "assistantAudio",
    "assistantSpeaking",
    "interrupted",
    "reconnecting",
    "error",
    "ended",
] as const;
export type VoiceEventName = (typeof REQUIRED_VOICE_EVENTS)[number];

/** Normalized name -> the shared RealtimeEvent type every adapter emits. */
export const VOICE_EVENT_MAP: Record<VoiceEventName, RealtimeEvent["type"]> = {
    connecting: "sessionConnecting",
    connected: "sessionReady",
    listening: "listening",
    userSpeaking: "userSpeechStarted",
    userTranscriptPartial: "userTranscriptDelta",
    userTranscriptFinal: "userTranscriptFinal",
    thinking: "thinking",
    assistantTextDelta: "assistantTextDelta",
    assistantAudio: "assistantAudioChunk",
    assistantSpeaking: "assistantResponseStarted",
    interrupted: "assistantInterrupted",
    reconnecting: "reconnecting",
    error: "error",
    ended: "sessionEnded",
};

export function isVoiceProtocol(protocol: string): protocol is VoiceProtocolId {
    return (VOICE_PROTOCOL_IDS as readonly string[]).includes(protocol);
}
