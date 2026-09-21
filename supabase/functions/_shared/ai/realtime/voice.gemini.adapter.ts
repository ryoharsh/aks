/**
 * Gemini voice adapter.
 *
 * Realtime bidirectional audio over a Gemini Live session. ALL
 * provider-specific details (auth, endpoint, model, wire protocol id) stay
 * inside this file — callers only see the provider-neutral VoiceProvider
 * contract and the shared session-spec shape.
 *
 * Auth (real provider handshake, server-side only): GEMINI_API_KEY never
 * leaves the server. createSession calls the Gemini ephemeral-token service
 * (POST /v1beta/auth_tokens) and returns Google's short-lived token in the
 * spec. The client connects directly to the Live websocket with that token
 * as an `access_token` query parameter (see the `auth` spec field and the
 * client transport). The raw key is never placed in the spec.
 *
 * Docs: Gemini Live API "Ephemeral tokens" — token defaults: 1 minute to
 * start new sessions (newSessionExpireTime), 30 minutes of messaging
 * (expireTime). We request uses:1 with the same windows.
 */

import type { AIProviderEnv } from "../providers/provider.config.ts";
import {
    assertGeminiVoiceConfig,
    VOICE_PROTOCOL_IDS,
    type RealtimeVoiceSessionSpec,
    type VoiceProvider,
} from "./voice.provider.ts";

const geminiAuthTokensUrl = "https://generativelanguage.googleapis.com/v1beta/auth_tokens";

/** Constrained Live endpoint used with ephemeral tokens (access_token query). */
const geminiLiveEndpoint = () =>
    "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

type EphemeralTokenResponse = {
    /** The token itself (AuthToken.name). */
    name?: unknown;
    expireTime?: unknown;
    newSessionExpireTime?: unknown;
};

function toEpochMs(value: unknown): number | null {
    if (typeof value !== "string" || !value) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Real handshake: mint a short-lived Live API token from Google using the
 * server-held key. Throws RATE_LIMITED on 429 and
 * REALTIME_PROVIDER_UNAVAILABLE on any other provider failure or malformed
 * response — never a fake credential.
 */
export async function mintGeminiEphemeralToken(apiKey: string): Promise<{ token: string; expiresAt: number | null }> {
    let response: Response;
    try {
        response = await fetch(geminiAuthTokensUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey.trim() },
            // REST AuthToken resource: uses/expireTime/newSessionExpireTime
            // are TOP-LEVEL fields. (The SDK's `config = {...}` wrapper is
            // client-library sugar — sending it raw yields 400 "Unknown
            // name \"config\" at 'auth_token'".)
            body: JSON.stringify({
                uses: 1,
                expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
            }),
        });
    } catch (error) {
        // The fetch itself threw (network/DNS/TLS or an invalid header
        // value). Preserve the cause so the edge-function log names it —
        // the key itself is never included.
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`REALTIME_PROVIDER_UNAVAILABLE: gemini auth_tokens fetch failed (${detail})`);
    }
    if (response.status === 429) throw new Error("RATE_LIMITED");
    if (!response.ok) {
        let body = "";
        try {
            body = await response.text();
        } catch {
            body = "";
        }
        throw new Error(`REALTIME_PROVIDER_UNAVAILABLE: gemini auth_tokens status ${response.status} ${body.slice(0, 300)}`);
    }
    let payload: EphemeralTokenResponse;
    try {
        payload = await response.json() as EphemeralTokenResponse;
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`REALTIME_PROVIDER_UNAVAILABLE: gemini auth_tokens bad JSON (${detail})`);
    }
    if (!payload || typeof payload.name !== "string" || !payload.name) {
        const keys = payload && typeof payload === "object" ? Object.keys(payload).join(",") : typeof payload;
        throw new Error(`REALTIME_PROVIDER_UNAVAILABLE: gemini auth_tokens missing token name (keys: ${keys})`);
    }
    return { token: payload.name, expiresAt: toEpochMs(payload.expireTime) };
}

export function createGeminiVoiceProvider(env: AIProviderEnv): VoiceProvider {
    // Requires ONLY GEMINI_API_KEY + AI_GEMINI_LIVE_MODEL. Never touches
    // another provider's secrets; missing config fails closed with
    // REALTIME_NOT_CONFIGURED and the factory never falls back to a
    // different provider.
    assertGeminiVoiceConfig(env);
    return {
        id: "gemini",
        architecture: "live",
        protocol: VOICE_PROTOCOL_IDS.gemini,
        async createSession(input: { instructions: string }): Promise<RealtimeVoiceSessionSpec> {
            // Re-validate per session so rotated/missing secrets fail fast
            // with the existing error codes.
            const live = assertGeminiVoiceConfig(env);
            const { token, expiresAt } = await mintGeminiEphemeralToken(live.apiKey);
            return {
                provider: "gemini",
                protocol: VOICE_PROTOCOL_IDS.gemini,
                transport: "websocket",
                endpoint: geminiLiveEndpoint(),
                sessionToken: token,
                tokenExpiresAt: expiresAt,
                model: live.model,
                instructions: input.instructions,
                inputSampleRate: 24000,
                outputSampleRate: 24000,
                pcmFormat: "pcm16",
                // Ephemeral tokens travel as an access_token query parameter,
                // not an Authorization header (see client transport).
                auth: { placement: "query", param: "access_token" },
                // Gemini Live owns STT + voice end to end: no separate
                // STT/TTS configuration is required or consulted.
                voice: "gemini-live-voice",
                transcriptionModel: live.model,
            };
        },
    };
}

export { geminiLiveEndpoint };
export const __geminiModelForTests = (env: AIProviderEnv) => assertGeminiVoiceConfig(env).model;
