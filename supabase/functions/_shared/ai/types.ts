export type AITask = "conversation_response" | "signal_extraction" | "memory_evaluation" | "pattern_analysis" | "experiment_analysis" | "learning_synthesis" | "insight_generation" | "reflection_transcription";

export type TranscriptionRequest = {
    audio: Uint8Array;
    mimeType: string;
};

export type TranscriptionResult = {
    text: string;
    provider: string;
    model: string;
    latencyMs: number;
};

export type AIRequest = {
    task: AITask;
    version: string;
    instructions: string;
    context: unknown;
};

export type AIResult = {
    content: string;
    provider: string;
    model: string;
    latencyMs: number;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
    };
};

export interface AIProvider {
    generate(input: AIRequest): Promise<AIResult>;
    transcribe?(input: TranscriptionRequest): Promise<TranscriptionResult>;
    /**
     * Streaming variant, when the adapter supports it. Yields incremental
     * safe-response text chunks as they arrive from the provider and resolves
     * with the full accumulated content (same shape as `generate`). The
     * caller still validates the final content before persistence —
     * streaming never bypasses validation.
     */
    generateStream?(input: AIRequest, onDelta: (text: string) => void, signal?: AbortSignal): Promise<AIResult>;
}

export class AIProviderError extends Error {
    policyBlocked: boolean;

    constructor(message: string, policyBlocked = false) {
        super(message);
        this.name = "AIProviderError";
        this.policyBlocked = policyBlocked;
    }
}

export function isPolicyBlockedError(error: unknown): boolean {
    return error instanceof Error && (error as { policyBlocked?: boolean }).policyBlocked === true;
}
