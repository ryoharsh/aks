/**
 * Provider-neutral VoiceProvider contract (server side).
 *
 * One top-level selector chooses the voice architecture:
 *
 *   AI_VOICE_PROVIDER=openai|gemini|sarvam
 *
 * Unknown names fail closed with the same honest `REALTIME_NOT_CONFIGURED`
 * error as missing credentials — the factory never falls back to another
 * provider and never reads credentials belonging to a different provider.
 *
 * Per-provider requirements (nothing else may be required):
 *
 * - openai: OPENAI_API_KEY + AI_REALTIME_MODEL. Realtime bidirectional
 *   audio; the provider owns transcription + audio response. The existing
 *   OpenAI realtime session/protocol implementation is reused as-is.
 * - gemini: GEMINI_API_KEY + AI_GEMINI_LIVE_MODEL. Realtime bidirectional
 *   audio/live session; auth/protocol/model details stay inside the
 *   Gemini adapter.
 * - sarvam: SARVAM_API_KEY + AI_STT_MODEL + AI_TTS_MODEL + the existing Aks
 *   LLM pipeline (AI_LLM_MODEL + provider base URL/key). Realtime
 *   Sarvam STT, final transcript -> existing Aks LLM, streamed Sarvam TTS.
 *   There is no separate LLM and no separate realtime model for sarvam.
 *
 * Provider selection happens here, server-side. Raw API keys never leave
 * the server: session specs carry only short-lived session tokens.
 *
 * Normalized voice events (exposed identically by all 3 adapters on the
 * client through the shared RealtimeEvent contract — see the mapping in
 * `src/services/realtime/providers/voice-provider.ts`):
 *
 *   connecting, connected, listening, userSpeaking, userTranscriptPartial,
 *   userTranscriptFinal, thinking, assistantTextDelta, assistantAudio,
 *   assistantSpeaking, interrupted, reconnecting, error, ended
 */

import type { AIProviderEnv } from "../providers/provider.config.ts";
import {
    resolveGeminiLiveModelName,
    resolveLLMModelName,
    resolveSTTModelName,
    resolveVoiceProviderId,
    VOICE_PROVIDER_IDS,
    type VoiceProviderId,
} from "../providers/provider.config.ts";
import type { RealtimeVoiceSessionProvider, RealtimeVoiceSessionSpec } from "./session.provider.ts";

// Re-exported so existing importers (session factory, adapters, tests) keep
// a single import path — the implementation lives in provider.config.ts.
export { resolveVoiceProviderId, VOICE_PROVIDER_IDS, type VoiceProviderId };

/** Voice architecture owned by each provider. */
export type VoiceArchitecture = "realtime" | "live" | "stt-llm-tts";

export const VOICE_ARCHITECTURE: Record<VoiceProviderId, VoiceArchitecture> = {
    openai: "realtime",
    gemini: "live",
    sarvam: "stt-llm-tts",
};

/** Wire protocol ids minted by each provider. */
export const VOICE_PROTOCOL_IDS = {
    openai: "openai-realtime",
    gemini: "gemini-live",
    sarvam: "sarvam-pipeline",
} as const;

/**
 * Provider-neutral voice adapter. Every adapter validates only its own
 * required configuration (throwing `REALTIME_NOT_CONFIGURED` when anything
 * is missing) and mints a session spec over the shared transport shape, so
 * callers (`realtime-session`, clients) never name a vendor.
 */
export interface VoiceProvider {
    readonly id: VoiceProviderId;
    readonly architecture: VoiceArchitecture;
    readonly protocol: string;
    createSession(input: { instructions: string }): Promise<RealtimeVoiceSessionSpec>;
}

/** OpenAI requires only its key + realtime model — never another provider's secrets. */
export function assertOpenAIVoiceConfig(env: AIProviderEnv): { apiKey: string; model: string } {
    // Trim: `supabase secrets set` values with a trailing newline/space
    // otherwise produce an invalid Authorization header and the fetch
    // itself throws (surfacing as a generic provider-unavailable).
    const apiKey = env.OPENAI_API_KEY?.trim();
    const model = env.AI_REALTIME_MODEL?.trim();
    if (!apiKey || !model) throw new Error("REALTIME_NOT_CONFIGURED");
    return { apiKey, model };
}

/** Gemini requires only its key + live model — never another provider's secrets. */
export function assertGeminiVoiceConfig(env: AIProviderEnv): { apiKey: string; model: string } {
    // Trim: a trailing newline/space in the stored secret makes the
    // x-goog-api-key header invalid and the fetch itself throws (surfacing
    // as a generic provider-unavailable).
    const apiKey = env.GEMINI_API_KEY?.trim();
    const model = resolveGeminiLiveModelName(env)?.trim();
    if (!apiKey || !model) throw new Error("REALTIME_NOT_CONFIGURED");
    return { apiKey, model };
}

/**
 * Sarvam requires its key + STT model + TTS model + the existing Aks LLM
 * pipeline model. There is no separate LLM and no separate realtime model:
 * the final transcript flows through the same provider-neutral LLM config
 * every other Aks turn uses.
 */
export function assertSarvamVoiceConfig(env: AIProviderEnv): {
    apiKey: string;
    sttModel: string;
    ttsModel: string;
    llmModel: string;
} {
    const apiKey = env.SARVAM_API_KEY;
    const sttModel = resolveSTTModelName(env);
    const ttsModel = env.AI_TTS_MODEL;
    const llmModel = resolveLLMModelName(env);
    if (!apiKey || !sttModel || !ttsModel || !llmModel) throw new Error("REALTIME_NOT_CONFIGURED");
    return { apiKey, sttModel, ttsModel, llmModel };
}

export type { RealtimeVoiceSessionProvider, RealtimeVoiceSessionSpec };
