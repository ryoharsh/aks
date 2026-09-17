import type { Message } from "./data";

export type MirrorErrorCode =
    | "MESSAGE_SAVE_FAILED"
    | "AI_UNAVAILABLE"
    | "INVALID_AI_OUTPUT"
    | "RATE_LIMITED"
    | "ATTEMPTS_EXHAUSTED"
    | "CONVERSATION_UNAVAILABLE"
    | "VOICE_UNAVAILABLE";

export type MirrorResponse = {
    response: { text: string };
    signals: Array<{
        signalType: string;
        value: Record<string, unknown>;
        confidence: number | null;
    }>;
    memoryCandidates: Array<{ action: "created" | "updated"; memoryId: string; status: "candidate" | "active" | "rejected" | "archived" }>;
    patternActions: Array<{ action: "created" | "updated"; patternId: string; status: "candidate" | "possible" | "testing" | "supported" | "not_supported" | "archived" }>;
    followUp: string | null;
};

export type MirrorTurn = {
    conversationId: string;
    userMessage: Message;
    assistantMessage: Message | null;
    result: MirrorResponse | null;
    processingError: { code: MirrorErrorCode; message: string; retryable: boolean } | null;
};

export type PendingMirrorTurn = {
    conversationId: string;
    userMessage: Message;
};
