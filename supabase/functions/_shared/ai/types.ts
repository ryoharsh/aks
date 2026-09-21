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

/**
 * Provider failures carry enough structure for callers to make honest
 * decisions: whether the request may safely be retried (transient), whether
 * the input was rejected by content policy (never retry, never show the
 * provider's text), and how long the provider asked us to wait.
 */
export type AIProviderErrorOptions = {
    status?: number | null;
    retryable?: boolean;
    retryAfterMs?: number | null;
    detail?: string | null;
};

export class AIProviderError extends Error {
    policyBlocked: boolean;
    status: number | null;
    retryable: boolean;
    retryAfterMs: number | null;
    /** Provider-supplied detail, for logs only — never surfaced to the user. */
    detail: string | null;

    constructor(message: string, policyBlocked = false, options: AIProviderErrorOptions = {}) {
        super(message);
        this.name = "AIProviderError";
        this.policyBlocked = policyBlocked;
        this.status = options.status ?? null;
        this.retryable = options.retryable ?? false;
        this.retryAfterMs = options.retryAfterMs ?? null;
        this.detail = options.detail ?? null;
    }
}

export function isPolicyBlockedError(error: unknown): boolean {
    return error instanceof Error && (error as { policyBlocked?: boolean }).policyBlocked === true;
}

/** A transient provider/transport failure that may be attempted again. */
export function isRetryableProviderError(error: unknown): boolean {
    return error instanceof AIProviderError && error.retryable === true;
}
