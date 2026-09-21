/**
 * Server-side provider selection for the AI/voice layer.
 *
 * Each capability (LLM, STT, TTS voice, realtime session) resolves its
 * implementation and model from environment, so swapping vendors never
 * touches call sites (MirrorCore, edge functions) or clients — they only see
 * the adapter interfaces and the wire spec. Only the adapters named below
 * exist; unknown names fail closed with the same honest "not configured"
 * errors as missing credentials. Env is injectable for tests; production
 * callers pass nothing and read Deno env.
 */

export type AIProviderEnv = {
    AI_LLM_PROVIDER?: string;
    AI_LLM_MODEL?: string;
    AI_BASE_URL?: string;
    AI_API_KEY?: string;
    OPENAI_API_KEY?: string;
    AI_STT_PROVIDER?: string;
    AI_STT_MODEL?: string;
    AI_TTS_PROVIDER?: string;
    AI_TTS_MODEL?: string;
    /** Voice selector: openai|gemini|sarvam. Defaults to openai when unset. */
    AI_VOICE_PROVIDER?: string;
    GEMINI_API_KEY?: string;
    AI_GEMINI_LIVE_MODEL?: string;
    SARVAM_API_KEY?: string;
    AI_REALTIME_MODEL?: string;
};

const defaultEnv = (): AIProviderEnv => {
    try {
        return (globalThis as { Deno?: { env: { toObject(): Record<string, string> } } }).Deno?.env.toObject() ?? {};
    } catch {
        return {};
    }
};

/**
 * Single server-env reader. Every resolver defaults to this — no caller
 * keeps its own copy, so each variable is read from exactly one place.
 */
export const readServerEnv = defaultEnv;

export const LLM_PROVIDER_IDS = ["openai-compatible"] as const;
export type LLMProviderId = (typeof LLM_PROVIDER_IDS)[number];

export type LLMConfig = {
    providerId: LLMProviderId;
    model: string;
    baseUrl: string;
    apiKey: string;
};

/**
 * Single-name model resolvers. Each capability has exactly one variable —
 * no aliases, no fallback chains. Callers import these.
 */

/** LLM model: AI_LLM_MODEL. */
export function resolveLLMModelName(env: AIProviderEnv): string | undefined {
    return env.AI_LLM_MODEL;
}

/** STT model: AI_STT_MODEL. */
export function resolveSTTModelName(env: AIProviderEnv): string | undefined {
    return env.AI_STT_MODEL;
}

/** Gemini Live model: AI_GEMINI_LIVE_MODEL. */
export function resolveGeminiLiveModelName(env: AIProviderEnv): string | undefined {
    return env.AI_GEMINI_LIVE_MODEL;
}

export function resolveLLMConfig(env: AIProviderEnv = defaultEnv()): LLMConfig {
    const providerId = env.AI_LLM_PROVIDER ?? "openai-compatible";
    if (!(LLM_PROVIDER_IDS as readonly string[]).includes(providerId)) throw new Error("AI_NOT_CONFIGURED");
    const model = resolveLLMModelName(env);
    const baseUrl = env.AI_BASE_URL;
    const apiKey = env.AI_API_KEY;
    if (!model || !baseUrl || !apiKey) throw new Error("AI_NOT_CONFIGURED");
    return { providerId: providerId as LLMProviderId, model, baseUrl, apiKey };
}

export const STT_PROVIDER_IDS = ["whisper"] as const;
export type STTProviderId = (typeof STT_PROVIDER_IDS)[number];

export type STTConfig = {
    providerId: STTProviderId;
    /** Null when no model is configured; file upload requires an explicit model. */
    model: string | null;
};

export function resolveSTTConfig(env: AIProviderEnv = defaultEnv()): STTConfig {
    const providerId = env.AI_STT_PROVIDER ?? "whisper";
    if (!(STT_PROVIDER_IDS as readonly string[]).includes(providerId)) throw new Error("TRANSCRIPTION_NOT_CONFIGURED");
    return { providerId: providerId as STTProviderId, model: resolveSTTModelName(env) ?? null };
}

export const TTS_PROVIDER_IDS = ["openai"] as const;
export type TTSProviderId = (typeof TTS_PROVIDER_IDS)[number];

export type RealtimeVoiceConfig = {
    /** Voice id for the realtime session. Defaults to the current "alloy". */
    voice: string;
    /** Transcription model for realtime input audio. Defaults to "whisper-1". */
    transcriptionModel: string;
};

export function resolveRealtimeVoiceConfig(env: AIProviderEnv = defaultEnv()): RealtimeVoiceConfig {
    const ttsProvider = env.AI_TTS_PROVIDER ?? "openai";
    if (!(TTS_PROVIDER_IDS as readonly string[]).includes(ttsProvider)) throw new Error("REALTIME_NOT_CONFIGURED");
    const stt = resolveSTTConfig(env);
    return {
        voice: env.AI_TTS_MODEL ?? "alloy",
        transcriptionModel: stt.model ?? "whisper-1",
    };
}

export const VOICE_PROVIDER_IDS = ["openai", "gemini", "sarvam"] as const;
export type VoiceProviderId = (typeof VOICE_PROVIDER_IDS)[number];

/**
 * Single voice selector: AI_VOICE_PROVIDER. Anything unregistered fails
 * closed with the same honest error as missing credentials.
 */
export function resolveVoiceProviderId(env: AIProviderEnv = defaultEnv()): VoiceProviderId {
    const selected = env.AI_VOICE_PROVIDER ?? "openai";
    if (!(VOICE_PROVIDER_IDS as readonly string[]).includes(selected)) throw new Error("REALTIME_NOT_CONFIGURED");
    return selected as VoiceProviderId;
}
