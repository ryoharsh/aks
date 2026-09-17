import { OpenAICompatibleProvider } from "./providers/openai-compatible.ts";
import type { AIProvider, AIRequest } from "./types.ts";

export function generateWithProvider(provider: AIProvider, input: AIRequest) {
    return provider.generate(input);
}

function createProvider(): AIProvider {
    const baseUrl = Deno.env.get("AI_BASE_URL");
    const apiKey = Deno.env.get("AI_API_KEY");
    const model = Deno.env.get("AI_MODEL");
    if (!baseUrl || !apiKey || !model) throw new Error("AI_NOT_CONFIGURED");
    return new OpenAICompatibleProvider(baseUrl, apiKey, model);
}

export const aiService = {
    generate(input: AIRequest) {
        return generateWithProvider(createProvider(), input);
    },
};
