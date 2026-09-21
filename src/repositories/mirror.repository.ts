import { fetch as streamingFetch } from "expo/fetch";

import { supabase, supabaseUrl, assertSupabaseConfigured } from "@/lib/supabase";
import type { Json } from "@/types/database";
import type { Message } from "@/types/data";

type AssistantMessage = {
    id: string;
    conversationId: string;
    role: "assistant";
    content: string;
    replyToMessageId: string;
    metadata: Json;
    createdAt: string;
};

type MirrorFunctionResponse = {
    conversationId: string;
    response: { response: { text: string }; followUp: string | null };
    assistantMessage: AssistantMessage;
    signalsSaved: number;
    signals: Array<{ signalType: string; value: Record<string, unknown>; confidence: number | null }>;
    memoryCandidates: Array<{ action: "created" | "updated"; memoryId: string; status: "candidate" | "active" | "rejected" | "archived" }>;
    patternActions: Array<{ action: "created" | "updated"; patternId: string; status: "candidate" | "possible" | "testing" | "supported" | "not_supported" | "archived" }>;
    observable: boolean;
};

/** Payload of the mirror-stream "done" event (the persisted reply). */
export type MirrorStreamResult = {
    conversationId: string;
    response: { response: { text: string }; followUp: string | null };
    assistantMessage: AssistantMessage;
    observable: boolean;
};

export class MirrorRepositoryError extends Error {
    constructor(public readonly code: "AI_UNAVAILABLE" | "INVALID_AI_OUTPUT" | "RATE_LIMITED" | "ATTEMPTS_EXHAUSTED" | "CONVERSATION_UNAVAILABLE" | "NOTHING_TO_REGENERATE") {
        super(code);
        this.name = "MirrorRepositoryError";
    }
}

function errorFromCode(code: string | undefined): MirrorRepositoryError {
    if (code === "INVALID_AI_OUTPUT") return new MirrorRepositoryError("INVALID_AI_OUTPUT");
    if (code === "RATE_LIMITED") return new MirrorRepositoryError("RATE_LIMITED");
    if (code === "ATTEMPTS_EXHAUSTED") return new MirrorRepositoryError("ATTEMPTS_EXHAUSTED");
    if (code === "NOTHING_TO_REGENERATE") return new MirrorRepositoryError("NOTHING_TO_REGENERATE");
    if (code === "NOT_FOUND") return new MirrorRepositoryError("CONVERSATION_UNAVAILABLE");
    return new MirrorRepositoryError("AI_UNAVAILABLE");
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

/** Parse an SSE body into its `data:` JSON payloads, one per event. */
export async function* readSseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let carry = "";
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            carry += decoder.decode(value, { stream: true });
            const lines = carry.split("\n");
            carry = lines.pop() ?? "";
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;
                const data = trimmed.slice(5).trim();
                if (!data) continue;
                try {
                    yield JSON.parse(data) as Record<string, unknown>;
                } catch {
                    // Malformed event — skip, never crash the stream.
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

const supabaseAnonKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    "";

export const mirrorRepository = {
    /** Per-turn options. `language` is the language the app is currently
     * displaying, so the reply matches what the user is reading; the server
     * prefers it over the stored preference and ignores unknown codes. */
    async processMessage(conversationId: string, userMessageId: string, options: { regenerate?: boolean; language?: string } = {}) {
        assertSupabaseConfigured();
        const { data, error } = await supabase.functions.invoke<MirrorFunctionResponse>("mirror", {
            body: { conversationId, userMessageId, regenerate: options.regenerate === true, language: options.language },
        });
        if (error) {
            const context = (error as { context?: Response }).context;
            if (context) {
                try {
                    const payload = await context.clone().json() as { error?: { code?: string } };
                    throw errorFromCode(payload.error?.code);
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
    /**
     * Streaming variant of processMessage. Calls the mirror-stream edge
     * function, invokes onDelta with the accumulated response text as deltas
     * arrive, and resolves with the persisted assistant message. Throws
     * MirrorRepositoryError on stream error events — callers can fall back to
     * the non-streaming processMessage.
     */
    async processMessageStream(
        conversationId: string,
        userMessageId: string,
        onDelta: (accumulatedText: string) => void,
        options: { regenerate?: boolean; language?: string } = {},
    ): Promise<MirrorStreamResult> {
        assertSupabaseConfigured();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new MirrorRepositoryError("AI_UNAVAILABLE");

        const response = await streamingFetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/mirror-stream`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                apikey: supabaseAnonKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ conversationId, userMessageId, regenerate: options.regenerate === true, language: options.language }),
        });

        if (!response.ok || !response.body) {
            let code: string | undefined;
            try {
                const payload = await response.json() as { error?: { code?: string } };
                code = payload.error?.code;
            } catch {
                // Non-JSON error body — fall through to the generic code.
            }
            throw errorFromCode(code);
        }

        let accumulated = "";
        for await (const event of readSseEvents(response.body)) {
            if (event.type === "delta" && typeof event.text === "string") {
                accumulated = event.replace === true ? event.text : accumulated + event.text;
                onDelta(accumulated);
            } else if (event.type === "done") {
                const result = event as unknown as MirrorStreamResult;
                if (!isMessage(result.assistantMessage) || !result.response?.response?.text) {
                    throw new MirrorRepositoryError("INVALID_AI_OUTPUT");
                }
                return result;
            } else if (event.type === "error") {
                throw errorFromCode(typeof event.code === "string" ? event.code : undefined);
            }
        }
        throw new MirrorRepositoryError("AI_UNAVAILABLE");
    },
    async processObservations(conversationId: string, userMessageId: string) {
        assertSupabaseConfigured();
        const { data, error } = await supabase.functions.invoke("mirror-observe", {
            body: { conversationId, userMessageId },
        });
        if (error) throw new MirrorRepositoryError("AI_UNAVAILABLE");
        return data as {
            signalsSaved: number;
            signals: Array<{ signalType: string; value: Record<string, unknown>; confidence: number | null }>;
            memoryCandidates: Array<{ action: "created" | "updated"; memoryId: string; status: "candidate" | "active" | "rejected" | "archived" }>;
            patternActions: Array<{ action: "created" | "updated"; patternId: string; status: "candidate" | "possible" | "testing" | "supported" | "not_supported" | "archived" }>;
        };
    },
};
