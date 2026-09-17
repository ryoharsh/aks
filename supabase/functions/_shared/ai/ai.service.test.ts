import { describe, expect, it, vi } from "vitest";

import { generateWithProvider } from "./ai.service.ts";
import type { AIProvider, AIRequest } from "./types.ts";
import { AIProviderError, isPolicyBlockedError } from "./types.ts";

describe("AI service provider boundary", () => {
    it("delegates normalized requests without depending on a concrete provider", async () => {
        const generate = vi.fn().mockResolvedValue({
            content: "{}",
            provider: "test-provider",
            model: "test-model",
            latencyMs: 1,
        });
        const provider: AIProvider = { generate };
        const request: AIRequest = {
            task: "conversation_response",
            version: "conversation_response_v1",
            instructions: "Respond safely.",
            context: { currentMessage: "Hello" },
        };

        await expect(generateWithProvider(provider, request)).resolves.toMatchObject({ provider: "test-provider" });
        expect(generate).toHaveBeenCalledWith(request);
    });

    it("distinguishes a content-policy rejection from an ordinary failure", () => {
        expect(isPolicyBlockedError(new AIProviderError("AI_PROVIDER_UNAVAILABLE", true))).toBe(true);
        expect(isPolicyBlockedError(new AIProviderError("AI_PROVIDER_UNAVAILABLE"))).toBe(false);
        expect(isPolicyBlockedError(new Error("provider unavailable"))).toBe(false);
    });
});
