/**
 * Server-side voice provider factory.
 *
 * Single construction point for the provider-neutral VoiceProvider
 * contract. Resolves AI_VOICE_PROVIDER and builds ONLY the selected adapter — never another provider,
 * never a silent fallback. Unknown names and missing required config fail
 * closed with the existing `REALTIME_NOT_CONFIGURED` error.
 */

import type { AIProviderEnv } from "../providers/provider.config.ts";
import { readServerEnv } from "../providers/provider.config.ts";
import { resolveVoiceProviderId, type VoiceProvider } from "./voice.provider.ts";
import { createOpenAIVoiceProvider } from "./voice.openai.adapter.ts";
import { createGeminiVoiceProvider } from "./voice.gemini.adapter.ts";
import { createSarvamVoiceProvider } from "./voice.sarvam.adapter.ts";

export function createVoiceProvider(env: AIProviderEnv = readServerEnv()): VoiceProvider {
    const providerId = resolveVoiceProviderId(env);
    switch (providerId) {
        case "openai":
            return createOpenAIVoiceProvider(env);
        case "gemini":
            return createGeminiVoiceProvider(env);
        case "sarvam":
            return createSarvamVoiceProvider(env);
    }
}
