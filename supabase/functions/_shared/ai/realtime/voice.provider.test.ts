import { afterEach, describe, expect, it, vi } from "vitest";

import { createVoiceProvider } from "./voice.factory.ts";
import { createGeminiVoiceProvider } from "./voice.gemini.adapter.ts";
import { createOpenAIVoiceProvider } from "./voice.openai.adapter.ts";
import { createSarvamVoiceProvider } from "./voice.sarvam.adapter.ts";
import {
    resolveVoiceProviderId,
    VOICE_ARCHITECTURE,
    VOICE_PROTOCOL_IDS,
    type RealtimeVoiceSessionSpec,
    type VoiceProvider,
} from "./voice.provider.ts";

afterEach(() => {
    vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const openaiEnv = { AI_VOICE_PROVIDER: "openai", OPENAI_API_KEY: "sk-a", AI_REALTIME_MODEL: "gpt-4o-mini-realtime-preview" };
const geminiEnv = { AI_VOICE_PROVIDER: "gemini", GEMINI_API_KEY: "gem-key", AI_GEMINI_LIVE_MODEL: "models/gemini-3.8-live" };
const sarvamEnv = {
    AI_VOICE_PROVIDER: "sarvam",
    SARVAM_API_KEY: "sarvam-key",
    AI_STT_MODEL: "saarika:v2.5",
    AI_TTS_MODEL: "bulbul:v2",
    AI_LLM_PROVIDER: "openai-compatible",
    AI_LLM_MODEL: "aks-model",
};

/** Every adapter must mint the same shared spec shape over the same transport. */
function expectSharedSpecShape(spec: RealtimeVoiceSessionSpec) {
    expect(typeof spec.provider).toBe("string");
    expect(typeof spec.protocol).toBe("string");
    expect(spec.transport).toBe("websocket");
    expect(typeof spec.endpoint).toBe("string");
    expect(typeof spec.sessionToken).toBe("string");
    expect(spec.sessionToken.length).toBeGreaterThan(0);
    expect(typeof spec.model).toBe("string");
    expect(spec.model.length).toBeGreaterThan(0);
    expect(typeof spec.instructions).toBe("string");
    expect(typeof spec.inputSampleRate).toBe("number");
    expect(typeof spec.outputSampleRate).toBe("number");
    expect(spec.pcmFormat).toBe("pcm16");
    expect(typeof spec.voice).toBe("string");
    expect(typeof spec.transcriptionModel).toBe("string");
}

describe("VoiceProvider contract", () => {
    it("resolves the single top-level selector with openai default", () => {
        expect(resolveVoiceProviderId({ AI_VOICE_PROVIDER: "openai" })).toBe("openai");
        expect(resolveVoiceProviderId({ AI_VOICE_PROVIDER: "gemini" })).toBe("gemini");
        expect(resolveVoiceProviderId({ AI_VOICE_PROVIDER: "sarvam" })).toBe("sarvam");
        expect(resolveVoiceProviderId({})).toBe("openai");
    });

    it("fails closed on unknown providers — never falls back", () => {
        expect(() => resolveVoiceProviderId({ AI_VOICE_PROVIDER: "other" })).toThrow("REALTIME_NOT_CONFIGURED");
        expect(() => createVoiceProvider({ AI_VOICE_PROVIDER: "other", OPENAI_API_KEY: "sk-a", AI_REALTIME_MODEL: "m" })).toThrow(
            "REALTIME_NOT_CONFIGURED",
        );
    });

    it("exposes one architecture + protocol per provider", () => {
        expect(VOICE_ARCHITECTURE).toEqual({ openai: "realtime", gemini: "live", sarvam: "stt-llm-tts" });
        expect(VOICE_PROTOCOL_IDS).toEqual({ openai: "openai-realtime", gemini: "gemini-live", sarvam: "sarvam-pipeline" });
        expect(createVoiceProvider(openaiEnv).protocol).toBe("openai-realtime");
        expect(createVoiceProvider(geminiEnv).protocol).toBe("gemini-live");
        expect(createVoiceProvider(sarvamEnv).protocol).toBe("sarvam-pipeline");
    });

    it("openai and gemini adapters expose the same normalized interface and spec shape", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockImplementation((url: string) => {
                if (String(url).includes("auth_tokens")) {
                    return Promise.resolve(jsonResponse({ name: "gemini-ephemeral-token", expireTime: "2026-09-21T12:30:00.000Z" }));
                }
                return Promise.resolve(jsonResponse({ client_secret: { value: "ephemeral-token", expires_at: 1_800_000_000 } }));
            }),
        );
        const adapters: VoiceProvider[] = [createVoiceProvider(openaiEnv), createVoiceProvider(geminiEnv)];
        expect(adapters.map((adapter) => adapter.id)).toEqual(["openai", "gemini"]);
        for (const adapter of adapters) {
            expect(typeof adapter.createSession).toBe("function");
            const spec = await adapter.createSession({ instructions: "Be Aks." });
            expectSharedSpecShape(spec);
            expect(spec.instructions).toBe("Be Aks.");
        }
        const [openaiSpec, geminiSpec] = await Promise.all(
            adapters.map((adapter) => adapter.createSession({ instructions: "Be Aks." })),
        );
        expect(openaiSpec!.provider).toBe("openai");
        expect(geminiSpec!.provider).toBe("gemini");
    });

    it("sarvam exposes the same interface but never mints fake credentials", async () => {
        const adapter = createVoiceProvider(sarvamEnv);
        expect(adapter.id).toBe("sarvam");
        expect(adapter.architecture).toBe("stt-llm-tts");
        expect(adapter.protocol).toBe("sarvam-pipeline");
        // No server relay is deployed and Sarvam has no token-mint API, so
        // session creation fails closed with an explicit error — never a
        // fabricated token.
        await expect(adapter.createSession({ instructions: "Be Aks." })).rejects.toThrow("REALTIME_PROVIDER_UNAVAILABLE");
    });

    it("openai requires only its key + realtime model (existing flow untouched)", () => {
        expect(() => createOpenAIVoiceProvider({ AI_VOICE_PROVIDER: "openai" })).toThrow("REALTIME_NOT_CONFIGURED");
        expect(() => createOpenAIVoiceProvider({ AI_VOICE_PROVIDER: "openai", OPENAI_API_KEY: "sk-a" })).toThrow("REALTIME_NOT_CONFIGURED");
        // Unrelated providers' secrets are never required and never consulted.
        expect(() => createOpenAIVoiceProvider({ ...openaiEnv, SARVAM_API_KEY: undefined, GEMINI_API_KEY: undefined })).not.toThrow();
        expect(createOpenAIVoiceProvider(openaiEnv).id).toBe("openai");
    });

    it("gemini requires only its key + live model", () => {
        expect(() => createGeminiVoiceProvider({ AI_VOICE_PROVIDER: "gemini" })).toThrow("REALTIME_NOT_CONFIGURED");
        expect(() => createGeminiVoiceProvider({ AI_VOICE_PROVIDER: "gemini", GEMINI_API_KEY: "k" })).toThrow("REALTIME_NOT_CONFIGURED");
        expect(() => createGeminiVoiceProvider({ AI_VOICE_PROVIDER: "gemini", AI_GEMINI_LIVE_MODEL: "m" })).toThrow("REALTIME_NOT_CONFIGURED");
        // OPENAI_API_KEY / SARVAM_API_KEY / separate STT-TTS config are NOT required.
        expect(createGeminiVoiceProvider(geminiEnv).id).toBe("gemini");
        // AI_REALTIME_MODEL alone is the OpenAI model — it never selects Gemini config.
        expect(() => createGeminiVoiceProvider({ AI_VOICE_PROVIDER: "gemini", GEMINI_API_KEY: "k", AI_REALTIME_MODEL: "legacy-live" })).toThrow(
            "REALTIME_NOT_CONFIGURED",
        );
    });

    it("gemini mints a real ephemeral token server-side and never exposes the API key", async () => {
        const fetchMock = vi.fn().mockImplementation(() =>
            Promise.resolve(jsonResponse({ name: "gemini-ephemeral-token", expireTime: "2026-09-21T12:30:00.000Z" })),
        );
        vi.stubGlobal("fetch", fetchMock);
        const spec = await createVoiceProvider(geminiEnv).createSession({ instructions: "Be Aks." });
        expectSharedSpecShape(spec);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/auth_tokens");
        expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("gem-key");
        expect(JSON.parse(String(init.body))).toMatchObject({ uses: 1 });
        expect(spec.sessionToken).toBe("gemini-ephemeral-token");
        expect(spec.sessionToken).not.toContain("gem-key");
        expect(spec.endpoint).toContain("BidiGenerateContentConstrained");
        expect(spec.auth).toEqual({ placement: "query", param: "access_token" });
        expect(spec.tokenExpiresAt).toBe(Date.parse("2026-09-21T12:30:00.000Z"));
    });

    it("gemini surfaces provider rejections with existing error codes", async () => {
        vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ error: "quota" }, 429))));
        await expect(createVoiceProvider(geminiEnv).createSession({ instructions: "Be Aks." })).rejects.toThrow("RATE_LIMITED");

        vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ error: "bad" }, 400))));
        await expect(createVoiceProvider(geminiEnv).createSession({ instructions: "Be Aks." })).rejects.toThrow("REALTIME_PROVIDER_UNAVAILABLE");

        vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ unexpected: true }))));
        await expect(createVoiceProvider(geminiEnv).createSession({ instructions: "Be Aks." })).rejects.toThrow("REALTIME_PROVIDER_UNAVAILABLE");

        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
        await expect(createVoiceProvider(geminiEnv).createSession({ instructions: "Be Aks." })).rejects.toThrow("REALTIME_PROVIDER_UNAVAILABLE");
    });

    it("sarvam requires its key + STT + TTS + existing LLM model — no realtime model", () => {
        expect(() => createSarvamVoiceProvider({ AI_VOICE_PROVIDER: "sarvam" })).toThrow("REALTIME_NOT_CONFIGURED");
        const { AI_LLM_MODEL: _llm, ...noLlm } = sarvamEnv;
        expect(() => createSarvamVoiceProvider(noLlm)).toThrow("REALTIME_NOT_CONFIGURED");
        const { AI_STT_MODEL: _stt, ...noStt } = sarvamEnv;
        expect(() => createSarvamVoiceProvider(noStt)).toThrow("REALTIME_NOT_CONFIGURED");
        const { AI_TTS_MODEL: _tts, ...noTts } = sarvamEnv;
        expect(() => createSarvamVoiceProvider(noTts)).toThrow("REALTIME_NOT_CONFIGURED");
        // OPENAI_API_KEY / GEMINI_API_KEY / AI_REALTIME_MODEL are NOT required.
        expect(createSarvamVoiceProvider(sarvamEnv).id).toBe("sarvam");
        // Old alias names are gone: only the single names configure Sarvam.
        expect(() =>
            createSarvamVoiceProvider({ AI_VOICE_PROVIDER: "sarvam", SARVAM_API_KEY: "k", AI_TRANSCRIBE_MODEL: "stt", AI_TTS_MODEL: "tts", AI_MODEL: "llm" }),
        ).toThrow("REALTIME_NOT_CONFIGURED");
    });

    it("sarvam session creation fails closed without a deployed relay — no fabricated token", async () => {
        await expect(createVoiceProvider(sarvamEnv).createSession({ instructions: "Be Aks." }))
            .rejects.toThrow("REALTIME_PROVIDER_UNAVAILABLE");
    });

    it("never falls back: missing config fails even when another provider is fully configured", () => {
        // Sarvam fully configured, but openai selected without its key.
        expect(() => createVoiceProvider({ ...sarvamEnv, AI_VOICE_PROVIDER: "openai" })).toThrow("REALTIME_NOT_CONFIGURED");
        // OpenAI fully configured, but gemini selected without its key.
        expect(() => createVoiceProvider({ ...openaiEnv, AI_VOICE_PROVIDER: "gemini" })).toThrow("REALTIME_NOT_CONFIGURED");
    });
});
