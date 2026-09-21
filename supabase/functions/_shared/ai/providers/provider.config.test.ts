import { describe, expect, it } from "vitest";

import {
    resolveGeminiLiveModelName,
    resolveLLMConfig,
    resolveLLMModelName,
    resolveRealtimeVoiceConfig,
    resolveSTTConfig,
    resolveSTTModelName,
    resolveVoiceProviderId,
} from "./provider.config.ts";

const llmEnv = {
    AI_BASE_URL: "https://provider.test/v1",
    AI_API_KEY: "test-key",
    AI_LLM_MODEL: "aks-model",
};

describe("Provider selection", () => {
    it("selects the OpenAI-compatible LLM by default", () => {
        expect(resolveLLMConfig(llmEnv)).toEqual({
            providerId: "openai-compatible",
            model: "aks-model",
            baseUrl: "https://provider.test/v1",
            apiKey: "test-key",
        });
    });

    it("fails closed on unknown LLM providers and missing credentials", () => {
        expect(() => resolveLLMConfig({ ...llmEnv, AI_LLM_PROVIDER: "other" })).toThrow("AI_NOT_CONFIGURED");
        expect(() => resolveLLMConfig({})).toThrow("AI_NOT_CONFIGURED");
        expect(() => resolveLLMConfig({ ...llmEnv, AI_LLM_MODEL: undefined })).toThrow("AI_NOT_CONFIGURED");
    });

    it("defaults STT to whisper-1 with an explicit model", () => {
        expect(resolveSTTConfig({})).toEqual({ providerId: "whisper", model: null });
        expect(resolveSTTConfig({ AI_STT_MODEL: "whisper-1" }).model).toBe("whisper-1");
        expect(() => resolveSTTConfig({ AI_STT_PROVIDER: "other" })).toThrow("TRANSCRIPTION_NOT_CONFIGURED");
    });

    it("keeps realtime voice defaults byte-identical without env overrides", () => {
        expect(resolveRealtimeVoiceConfig({})).toEqual({ voice: "alloy", transcriptionModel: "whisper-1" });
    });

    it("selects realtime voice and transcription from env", () => {
        expect(resolveRealtimeVoiceConfig({ AI_TTS_MODEL: "verse", AI_STT_MODEL: "custom-stt" })).toEqual({
            voice: "verse",
            transcriptionModel: "custom-stt",
        });
    });

    it("fails closed on unknown voice providers and TTS providers", () => {
        expect(resolveVoiceProviderId({})).toBe("openai");
        expect(() => resolveVoiceProviderId({ AI_VOICE_PROVIDER: "other" })).toThrow("REALTIME_NOT_CONFIGURED");
        expect(() => resolveRealtimeVoiceConfig({ AI_TTS_PROVIDER: "other" })).toThrow("REALTIME_NOT_CONFIGURED");
    });

    it("resolves the single voice selector", () => {
        expect(resolveVoiceProviderId({})).toBe("openai");
        expect(resolveVoiceProviderId({ AI_VOICE_PROVIDER: "sarvam" })).toBe("sarvam");
        expect(resolveVoiceProviderId({ AI_VOICE_PROVIDER: "gemini" })).toBe("gemini");
        expect(() => resolveVoiceProviderId({ AI_VOICE_PROVIDER: "other" })).toThrow("REALTIME_NOT_CONFIGURED");
    });

    it("resolves each model from its single variable", () => {
        expect(resolveLLMModelName({ AI_LLM_MODEL: "llm" })).toBe("llm");
        expect(resolveLLMModelName({})).toBeUndefined();
        expect(resolveSTTModelName({ AI_STT_MODEL: "stt" })).toBe("stt");
        expect(resolveSTTModelName({})).toBeUndefined();
        expect(resolveGeminiLiveModelName({ AI_GEMINI_LIVE_MODEL: "live" })).toBe("live");
        expect(resolveGeminiLiveModelName({})).toBeUndefined();
    });
});
