import { describe, expect, it } from "vitest";

import { TTS_PROVIDER_IDS, createTTSProvider } from "./tts-provider.registry";

describe("TTS provider registry", () => {
    it("resolves the bundled on-device provider by name", () => {
        expect(TTS_PROVIDER_IDS).toContain("expo-speech");
    });

    it("fails closed on unknown provider names instead of substituting a voice", async () => {
        await expect(createTTSProvider("other")).rejects.toThrow("TTS_PROVIDER_NOT_CONFIGURED");
        await expect(createTTSProvider("")).rejects.toThrow("TTS_PROVIDER_NOT_CONFIGURED");
    });
});
