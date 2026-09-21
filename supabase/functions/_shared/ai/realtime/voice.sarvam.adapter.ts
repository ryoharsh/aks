/**
 * Sarvam voice adapter.
 *
 * Intended architecture: realtime Sarvam STT -> final transcript -> the
 * EXISTING Aks LLM pipeline -> streamed Sarvam TTS. There is no separate
 * LLM and no separate realtime model.
 *
 * HONEST STATUS — READ BEFORE CHANGING: Sarvam's streaming APIs (STT
 * realtime websocket, TTS websocket) authenticate ONLY with the long-lived
 * `api-subscription-key`, which must never leave the server and therefore
 * can never be placed in a client session spec. Sarvam offers no ephemeral
 * token or session-mint API (unlike Gemini's auth_tokens). A live Sarvam
 * path requires a server-side relay (client <-> edge-function websocket
 * bridge holding the key, running the LLM pipeline server-side, streaming
 * TTS back) — that relay is NOT deployed in this repository.
 *
 * So this adapter validates configuration (failing closed with
 * REALTIME_NOT_CONFIGURED when anything is missing, never consulting other
 * providers' secrets) and createSession FAILS CLOSED with
 * REALTIME_PROVIDER_UNAVAILABLE instead of minting a fake credential. A
 * fake token would connect nowhere; an explicit error keeps the app honest.
 * All Sarvam-specific details stay inside this file.
 */

import type { AIProviderEnv } from "../providers/provider.config.ts";
import {
    assertSarvamVoiceConfig,
    VOICE_PROTOCOL_IDS,
    type RealtimeVoiceSessionSpec,
    type VoiceProvider,
} from "./voice.provider.ts";

export function createSarvamVoiceProvider(env: AIProviderEnv): VoiceProvider {
    // Requires ONLY SARVAM_API_KEY + AI_STT_MODEL + AI_TTS_MODEL + the
    // existing Aks LLM model. Never touches OPENAI_API_KEY / GEMINI_API_KEY
    // / AI_REALTIME_MODEL; missing config fails closed with
    // REALTIME_NOT_CONFIGURED and the factory never falls back.
    assertSarvamVoiceConfig(env);
    return {
        id: "sarvam",
        architecture: "stt-llm-tts",
        protocol: VOICE_PROTOCOL_IDS.sarvam,
        createSession(): Promise<RealtimeVoiceSessionSpec> {
            assertSarvamVoiceConfig(env);
            return Promise.reject(new Error(
                "REALTIME_PROVIDER_UNAVAILABLE: Sarvam live voice needs a server-side relay holding the subscription key, which is not deployed. No session was minted and no credential was issued.",
            ));
        },
    };
}

export const __sarvamConfigForTests = (env: AIProviderEnv) => assertSarvamVoiceConfig(env);
