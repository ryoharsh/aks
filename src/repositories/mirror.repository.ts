import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";
import type { Message } from "@/types/data";

type MirrorFunctionResponse = {
    conversationId: string;
    response: { response: { text: string }; followUp: string | null };
    assistantMessage: {
        id: string;
        conversationId: string;
        role: "assistant";
        content: string;
        replyToMessageId: string;
        metadata: Json;
        createdAt: string;
    };
    signalsSaved: number;
    signals: Array<{ signalType: string; value: Record<string, unknown>; confidence: number | null }>;
    memoryCandidates: Array<{ action: "created" | "updated"; memoryId: string; status: "candidate" | "active" | "rejected" | "archived" }>;
    patternActions: Array<{ action: "created" | "updated"; patternId: string; status: "candidate" | "possible" | "testing" | "supported" | "not_supported" | "archived" }>;
};

export class MirrorRepositoryError extends Error {
    constructor(public readonly code: "AI_UNAVAILABLE" | "INVALID_AI_OUTPUT" | "RATE_LIMITED" | "ATTEMPTS_EXHAUSTED" | "CONVERSATION_UNAVAILABLE") {
        super(code);
        this.name = "MirrorRepositoryError";
    }
}

function isMessage(value: unknown): value is Message {
    if (!value || typeof value !== "object") return false;
    const message = value as Record<string, unknown>;
    return typeof message.id === "string"
        && typeof message.conversationId === "string"
        && message.role === "assistant"
        && typeof message.content === "string"
        && typeof message.replyToMessageId === "string"
        && typeof message.createdAt === "string";
}

export const mirrorRepository = {
    async processMessage(conversationId: string, userMessageId: string) {
        const { data, error } = await supabase.functions.invoke<MirrorFunctionResponse>("mirror", {
            body: { conversationId, userMessageId },
        });
        if (error) {
            const context = (error as { context?: Response }).context;
            if (context) {
                try {
                    const payload = await context.clone().json() as { error?: { code?: string } };
                    if (payload.error?.code === "INVALID_AI_OUTPUT") throw new MirrorRepositoryError("INVALID_AI_OUTPUT");
                    if (payload.error?.code === "RATE_LIMITED") throw new MirrorRepositoryError("RATE_LIMITED");
                    if (payload.error?.code === "ATTEMPTS_EXHAUSTED") throw new MirrorRepositoryError("ATTEMPTS_EXHAUSTED");
                    if (payload.error?.code === "NOT_FOUND") throw new MirrorRepositoryError("CONVERSATION_UNAVAILABLE");
                } catch (parsedError) {
                    if (parsedError instanceof MirrorRepositoryError) throw parsedError;
                }
            }
            throw new MirrorRepositoryError("AI_UNAVAILABLE");
        }
        if (!data || !isMessage(data.assistantMessage) || !data.response?.response?.text) {
            throw new MirrorRepositoryError("INVALID_AI_OUTPUT");
        }
        return data;
    },
};
