import { OpenAICompatibleProvider } from "./providers/openai-compatible.ts";
import { resolveLLMConfig } from "./providers/provider.config.ts";
import type { AIProvider, AIRequest, TranscriptionRequest, TranscriptionResult } from "./types.ts";

export function generateWithProvider(provider: AIProvider, input: AIRequest) {
    return provider.generate(input);
}
export function transcribeWithProvider(provider: AIProvider, input: TranscriptionRequest): Promise<TranscriptionResult> {
    if (!provider.transcribe) throw new Error("TRANSCRIPTION_NOT_CONFIGURED");
    return provider.transcribe(input);
}

function createProvider(): AIProvider {
    // Vendor selection lives in provider.config (AI_LLM_PROVIDER /
    // AI_LLM_MODEL). Only adapters registered
    // there can be constructed; callers never name a vendor.
    const config = resolveLLMConfig();
    switch (config.providerId) {
        case "openai-compatible":
            return new OpenAICompatibleProvider(config.baseUrl, config.apiKey, config.model);
    }
}

export const aiService = {
    generate(input: AIRequest) {
        return generateWithProvider(createProvider(), input);
    },
    /**
     * Streaming generation through the same provider-neutral abstraction.
     * Falls back to non-streaming `generate` when the adapter has no
     * `generateStream` — callers always receive incremental deltas followed
     * by a complete AIResult either way.
     */
    async generateStream(
        input: AIRequest,
        onDelta: (text: string) => void,
        signal?: AbortSignal,
    ): Promise<AIResultLike> {
        const provider = createProvider();
        if (!provider.generateStream) {
            const result = await provider.generate(input);
            onDelta(result.content);
            return result;
        }
        return provider.generateStream(input, onDelta, signal);
    },
    transcribe(input: TranscriptionRequest): Promise<TranscriptionResult> {
        return transcribeWithProvider(createProvider(), input);
    },
};

export type AIResultLike = Awaited<ReturnType<typeof generateWithProvider>>;
