import type { AIProviderEnv } from "../providers/provider.config.ts";
import { resolveRealtimeVoiceConfig } from "../providers/provider.config.ts";
import { resolveVoiceProviderId } from "./voice.provider.ts";
import { createGeminiVoiceProvider } from "./voice.gemini.adapter.ts";
import { createSarvamVoiceProvider } from "./voice.sarvam.adapter.ts";

export type RealtimeVoiceSessionSpec = {
    provider: string;
    protocol: string;
    transport: "websocket";
    endpoint: string;
    sessionToken: string;
    tokenExpiresAt: number | null;
    model: string;
    instructions: string;
    inputSampleRate: number;
    outputSampleRate: number;
    pcmFormat: "pcm16";
    /**
     * How the client attaches the session token. Default (absent) is an
     * Authorization Bearer header (OpenAI). Gemini ephemeral tokens travel
     * as an `access_token` query parameter instead — the abstraction adapts
     * to the provider rather than faking compatibility.
     */
    auth?: { placement: "header" | "query"; param?: string };
    /** Server-selected voice id (AI_TTS_MODEL, default "alloy"). */
    voice: string;
    /** Server-selected transcription model (AI_STT_MODEL, default "whisper-1"). */
    transcriptionModel: string;
};

export interface RealtimeVoiceSessionProvider {
    createSession(input: { instructions: string }): Promise<RealtimeVoiceSessionSpec>;
}

const realtimeSessionsUrl = "https://api.openai.com/v1/realtime/sessions";

type OpenAIRealtimeEnv = Pick<AIProviderEnv, "OPENAI_API_KEY" | "AI_REALTIME_MODEL" | "AI_STT_PROVIDER" | "AI_STT_MODEL" | "AI_TTS_PROVIDER" | "AI_TTS_MODEL">;

export function createOpenAIRealtimeVoiceSessionProvider(env: OpenAIRealtimeEnv = Deno.env.toObject()): RealtimeVoiceSessionProvider {
    const apiKey = env.OPENAI_API_KEY;
    const model = env.AI_REALTIME_MODEL;
    if (!apiKey || !model) throw new Error("REALTIME_NOT_CONFIGURED");
    // Voice + transcription selection lives in provider.config; defaults keep
    // the exact wire values this flow has always sent.
    const voiceConfig = resolveRealtimeVoiceConfig(env);

    return {
        async createSession(input) {
            let sessionToken: string;
            let tokenExpiresAt: number | null = null;
            try {
                let response: Response;
                try {
                    response = await fetch(realtimeSessionsUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey.trim()}` },
                        body: JSON.stringify({
                            model,
                            voice: voiceConfig.voice,
                            input_audio_format: "pcm16",
                            output_audio_format: "pcm16",
                            input_audio_transcription: { model: voiceConfig.transcriptionModel },
                            turn_detection: { type: "server_vad", threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 600 },
                            instructions: input.instructions,
                        }),
                    });
                } catch (error) {
                    const detail = error instanceof Error ? error.message : String(error);
                    throw new Error(`REALTIME_PROVIDER_UNAVAILABLE: openai realtime sessions fetch failed (${detail})`);
                }
                if (response.status === 429) throw new Error("RATE_LIMITED");
                if (!response.ok) {
                    let body = "";
                    try {
                        body = await response.text();
                    } catch {
                        body = "";
                    }
                    throw new Error(`REALTIME_PROVIDER_UNAVAILABLE: openai realtime sessions status ${response.status} ${body.slice(0, 300)}`);
                }
                const session = await response.json();
                const clientSecret = (session as { client_secret?: unknown }).client_secret;
                if (!clientSecret || typeof clientSecret !== "object") throw new Error("REALTIME_PROVIDER_UNAVAILABLE: openai realtime sessions missing client_secret");
                const secret = clientSecret as { value?: unknown; expires_at?: unknown };
                if (typeof secret.value !== "string" || !secret.value) throw new Error("REALTIME_PROVIDER_UNAVAILABLE: openai realtime sessions missing client_secret value");
                sessionToken = secret.value;
                if (typeof secret.expires_at === "number") tokenExpiresAt = secret.expires_at;
            } catch (error) {
                if (error instanceof Error && (error.message === "RATE_LIMITED" || error.message.startsWith("REALTIME_PROVIDER_UNAVAILABLE"))) throw error;
                const detail = error instanceof Error ? error.message : String(error);
                throw new Error(`REALTIME_PROVIDER_UNAVAILABLE: openai session failed (${detail})`);
            }

            return {
                provider: "openai",
                protocol: "openai-realtime",
                transport: "websocket",
                endpoint: `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
                sessionToken,
                tokenExpiresAt,
                model,
                instructions: input.instructions,
                inputSampleRate: 24000,
                outputSampleRate: 24000,
                pcmFormat: "pcm16",
                voice: voiceConfig.voice,
                transcriptionModel: voiceConfig.transcriptionModel,
            };
        },
    };
}

export function createRealtimeVoiceSessionProvider(env: AIProviderEnv = Deno.env.toObject()): RealtimeVoiceSessionProvider {
    // Vendor selection lives in the provider-neutral voice contract
    // (AI_VOICE_PROVIDER). Only the selected adapter is constructed;
    // anything else fails closed as not configured — never a silent
    // fallback to another provider.
    const providerId = resolveVoiceProviderId(env);
    switch (providerId) {
        case "openai":
            return createOpenAIRealtimeVoiceSessionProvider(env);
        case "gemini":
            return createGeminiVoiceProvider(env);
        case "sarvam":
            return createSarvamVoiceProvider(env);
    }
}