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
