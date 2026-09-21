/**
 * OpenAI voice adapter.
 *
 * Thin wrapper over the existing OpenAI realtime session implementation in
 * `session.provider.ts`. That implementation is intentionally reused as-is:
 * realtime bidirectional audio where the provider owns realtime
 * transcription + the audio response. Nothing here changes the OpenAI wire
 * flow — it only exposes it behind the provider-neutral VoiceProvider
 * contract so selection can pick it without naming a vendor.
 */

import { createOpenAIRealtimeVoiceSessionProvider } from "./session.provider.ts";
import type { AIProviderEnv } from "../providers/provider.config.ts";
import type { RealtimeVoiceSessionSpec, VoiceProvider } from "./voice.provider.ts";

export function createOpenAIVoiceProvider(env: AIProviderEnv): VoiceProvider {
    // Validation + minting both live in the existing implementation, which
    // requires only OPENAI_API_KEY + AI_REALTIME_MODEL and fails closed with
    // REALTIME_NOT_CONFIGURED otherwise.
    const inner = createOpenAIRealtimeVoiceSessionProvider(env);
    return {
        id: "openai",
        architecture: "realtime",
        protocol: "openai-realtime",
        createSession(input: { instructions: string }): Promise<RealtimeVoiceSessionSpec> {
            return inner.createSession(input);
        },
    };
}
