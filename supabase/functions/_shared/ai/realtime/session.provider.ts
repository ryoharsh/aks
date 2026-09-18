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
};

export interface RealtimeVoiceSessionProvider {
    createSession(input: { instructions: string }): Promise<RealtimeVoiceSessionSpec>;
}

const realtimeSessionsUrl = "https://api.openai.com/v1/realtime/sessions";

export function createOpenAIRealtimeVoiceSessionProvider(env: { OPENAI_API_KEY?: string; AI_REALTIME_MODEL?: string } = Deno.env.toObject()): RealtimeVoiceSessionProvider {
    const apiKey = env.OPENAI_API_KEY;
    const model = env.AI_REALTIME_MODEL;
    if (!apiKey || !model) throw new Error("REALTIME_NOT_CONFIGURED");

    return {
        async createSession(input) {
            let sessionToken: string;
            let tokenExpiresAt: number | null = null;
            try {
                const response = await fetch(realtimeSessionsUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model,
                        voice: "alloy",
                        input_audio_format: "pcm16",
                        output_audio_format: "pcm16",
                        input_audio_transcription: { model: "whisper-1" },
                        turn_detection: { type: "server_vad", threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 600 },
                        instructions: input.instructions,
                    }),
                });
                if (response.status === 429) throw new Error("RATE_LIMITED");
                if (!response.ok) throw new Error("REALTIME_PROVIDER_UNAVAILABLE");
                const session = await response.json();
                const clientSecret = (session as { client_secret?: unknown }).client_secret;
                if (!clientSecret || typeof clientSecret !== "object") throw new Error("REALTIME_PROVIDER_UNAVAILABLE");
                const secret = clientSecret as { value?: unknown; expires_at?: unknown };
                if (typeof secret.value !== "string" || !secret.value) throw new Error("REALTIME_PROVIDER_UNAVAILABLE");
                sessionToken = secret.value;
                if (typeof secret.expires_at === "number") tokenExpiresAt = secret.expires_at;
            } catch (error) {
                if (error instanceof Error && (error.message === "RATE_LIMITED" || error.message === "REALTIME_PROVIDER_UNAVAILABLE")) throw error;
                throw new Error("REALTIME_PROVIDER_UNAVAILABLE");
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
            };
        },
    };
}

export function createRealtimeVoiceSessionProvider(): RealtimeVoiceSessionProvider {
    const provider = Deno.env.get("AI_REALTIME_PROVIDER");
    if (provider === "openai") return createOpenAIRealtimeVoiceSessionProvider();
    return {
        async createSession() {
            throw new Error("REALTIME_NOT_CONFIGURED");
        },
    };
}