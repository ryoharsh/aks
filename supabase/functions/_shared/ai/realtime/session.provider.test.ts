import { afterEach, describe, expect, it, vi } from "vitest";

import { createOpenAIRealtimeVoiceSessionProvider } from "./session.provider.ts";

afterEach(() => {
    vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("OpenAI realtime voice session provider", () => {
    it("requires an API key and a model", () => {
        expect(() => createOpenAIRealtimeVoiceSessionProvider({})).toThrow("REALTIME_NOT_CONFIGURED");
        expect(() => createOpenAIRealtimeVoiceSessionProvider({ OPENAI_API_KEY: "sk-a", AI_REALTIME_MODEL: "" })).toThrow("REALTIME_NOT_CONFIGURED");
    });

    it("mints an ephemeral session and returns a WebSocket spec", async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
            client_secret: { value: "ephemeral-token", expires_at: 1_800_000_000 },
        }));
        vi.stubGlobal("fetch", fetchMock);

        const provider = createOpenAIRealtimeVoiceSessionProvider({ OPENAI_API_KEY: "sk-a", AI_REALTIME_MODEL: "gpt-4o-mini-realtime-preview" });
        const spec = await provider.createSession({ instructions: "Be Aks." });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://api.openai.com/v1/realtime/sessions");
        expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-a");
        expect(JSON.parse(String(init.body))).toMatchObject({
            model: "gpt-4o-mini-realtime-preview",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: { model: "whisper-1" },
            turn_detection: { type: "server_vad" },
            instructions: "Be Aks.",
        });

        expect(spec).toEqual({
            provider: "openai",
            protocol: "openai-realtime",
            transport: "websocket",
            endpoint: "wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview",
            sessionToken: "ephemeral-token",
            tokenExpiresAt: 1_800_000_000,
            model: "gpt-4o-mini-realtime-preview",
            instructions: "Be Aks.",
            inputSampleRate: 24000,
            outputSampleRate: 24000,
            pcmFormat: "pcm16",
        });
    });

    it("surfaces rate limits as RATE_LIMITED", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: { code: "rate_limit_exceeded" } }, 429)));
        const provider = createOpenAIRealtimeVoiceSessionProvider({ OPENAI_API_KEY: "sk-a", AI_REALTIME_MODEL: "gpt-4o-mini-realtime-preview" });
        await expect(provider.createSession({ instructions: "Be Aks." })).rejects.toThrow("RATE_LIMITED");
    });

    it("treats provider failures and malformed responses as unavailable", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: { message: "bad" } }, 400)));
        const provider = createOpenAIRealtimeVoiceSessionProvider({ OPENAI_API_KEY: "sk-a", AI_REALTIME_MODEL: "gpt-4o-mini-realtime-preview" });
        await expect(provider.createSession({ instructions: "Be Aks." })).rejects.toThrow("REALTIME_PROVIDER_UNAVAILABLE");

        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ client_secret: {} })));
        await expect(provider.createSession({ instructions: "Be Aks." })).rejects.toThrow("REALTIME_PROVIDER_UNAVAILABLE");
    });
});