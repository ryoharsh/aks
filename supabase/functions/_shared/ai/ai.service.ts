import { OpenAICompatibleProvider } from "./providers/openai-compatible.ts";
import type { AIProvider, AIRequest, TranscriptionRequest, TranscriptionResult } from "./types.ts";

export function generateWithProvider(provider: AIProvider, input: AIRequest) {
    return provider.generate(input);
}
export function transcribeWithProvider(provider: AIProvider, input: TranscriptionRequest): Promise<TranscriptionResult> {
    if (!provider.transcribe) throw new Error("TRANSCRIPTION_NOT_CONFIGURED");
    return provider.transcribe(input);
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
