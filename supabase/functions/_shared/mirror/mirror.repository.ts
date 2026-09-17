import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type StoredAssistant = {
    id: string;
    conversationId: string;
    role: "assistant";
    content: string;
    replyToMessageId: string;
    metadata: Record<string, unknown>;
    createdAt: string;
};

export function createMirrorRepository(userClient: SupabaseClient, adminClient: SupabaseClient, userId: string) {
    return {
        async getConversation(id: string) {
            const { data, error } = await userClient.from("conversations").select("id, title, archived_at").eq("id", id).single();
            if (error || data.archived_at) throw new Error("CONVERSATION_UNAVAILABLE");
            return { id: data.id, title: data.title };
        },
        async getUserMessage(conversationId: string, messageId: string) {
            const { data, error } = await userClient.from("messages").select("id, role, content, created_at").eq("id", messageId).eq("conversation_id", conversationId).single();
            if (error || data.role !== "user") throw new Error("MESSAGE_UNAVAILABLE");
            return { id: data.id, content: data.content, createdAt: data.created_at };
        },
        async findAssistantReply(conversationId: string, messageId: string): Promise<StoredAssistant | null> {
            const { data, error } = await userClient.from("messages").select("id, conversation_id, role, content, reply_to_message_id, metadata, created_at").eq("conversation_id", conversationId).eq("role", "assistant").eq("reply_to_message_id", messageId).maybeSingle();
            if (error) throw new Error("CONTEXT_UNAVAILABLE");
            return data ? {
                id: data.id,
                conversationId: data.conversation_id,
                role: "assistant",
                content: data.content,
                replyToMessageId: data.reply_to_message_id,
                metadata: data.metadata,
                createdAt: data.created_at,
            } : null;
        },
        async getRecentMessages(conversationId: string, before: { createdAt: string; id: string }) {
            const { data, error } = await userClient.from("messages").select("role, content, created_at").eq("conversation_id", conversationId).or(`created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(12);
            if (error) throw new Error("CONTEXT_UNAVAILABLE");
            return data.reverse().map((message) => ({ role: message.role, content: message.content, createdAt: message.created_at }));
        },
        async getRecentSignals(before: string) {
            const { data, error } = await userClient.from("signals").select("signal_type, value, observed_at").lte("observed_at", before).order("observed_at", { ascending: false }).limit(8);
            if (error) throw new Error("CONTEXT_UNAVAILABLE");
            return data.map((signal) => ({ signalType: signal.signal_type, value: signal.value, observedAt: signal.observed_at }));
        },
        async getPreferences() {
            const { data, error } = await userClient.from("user_preferences").select("what_exploring, what_to_notice").maybeSingle();
            if (error) throw new Error("CONTEXT_UNAVAILABLE");
            return { whatExploring: data?.what_exploring ?? [], whatToNotice: data?.what_to_notice ?? [] };
        },
        async getSignalsForMessage(messageId: string) {
            const { data, error } = await userClient.from("signals").select("id, signal_type, value, confidence, observed_at, source_message_id").eq("source_message_id", messageId);
            if (error) throw new Error("CONTEXT_UNAVAILABLE");
            return data.map((signal) => ({ id: signal.id, signalType: signal.signal_type, value: signal.value, confidence: signal.confidence, observedAt: signal.observed_at, sourceMessageId: signal.source_message_id }));
        },
        async saveAssistant(input: { conversationId: string; userMessageId: string; content: string; responseText: string; followUp: string | null; taskVersion: string }) {
            const { data, error } = await adminClient.from("messages").insert({ conversation_id: input.conversationId, user_id: userId, role: "assistant", content: input.content, reply_to_message_id: input.userMessageId, metadata: { task_version: input.taskVersion, response_text: input.responseText, follow_up: input.followUp } }).select("id, conversation_id, role, content, reply_to_message_id, metadata, created_at").single();
            if (error) throw new Error("ASSISTANT_PERSISTENCE_FAILED");
            return { id: data.id, conversationId: data.conversation_id, role: "assistant" as const, content: data.content, replyToMessageId: data.reply_to_message_id, metadata: data.metadata, createdAt: data.created_at };
        },
        async saveSignals(input: { conversationId: string; userMessageId: string; observedAt: string; signals: Array<{ signalType: string; value: Record<string, unknown>; confidence: number | null }> }) {
            const { data, error } = await adminClient.from("signals").upsert(input.signals.map((signal) => ({ user_id: userId, source_type: "conversation", source_id: input.conversationId, source_message_id: input.userMessageId, signal_type: signal.signalType, value: signal.value, confidence: signal.confidence, observed_at: input.observedAt })), { onConflict: "source_message_id,signal_type" }).select("id, signal_type, value, confidence, observed_at, source_message_id");
            if (error) throw new Error("SIGNAL_PERSISTENCE_FAILED");
            return data.map((signal) => ({ id: signal.id, signalType: signal.signal_type, value: signal.value, confidence: signal.confidence, observedAt: signal.observed_at, sourceMessageId: signal.source_message_id }));
        },
        async claimAIRun(input: { conversationId: string; userMessageId: string; task: string }) {
            const { data, error } = await adminClient.rpc("claim_ai_run", { run_user_id: userId, run_conversation_id: input.conversationId, run_user_message_id: input.userMessageId, run_task: input.task });
            if (error || !data) {
                if (error?.message?.includes("MIRROR_ATTEMPTS_EXHAUSTED")) throw new Error("ATTEMPTS_EXHAUSTED");
                if (error?.message?.includes("MIRROR_RATE_LIMITED") || error?.message?.includes("MIRROR_IN_PROGRESS")) throw new Error("RATE_LIMITED");
                throw new Error("AI_RUN_UNAVAILABLE");
            }
            return data as { id: string; status: string };
        },
        async updateAIRun(id: string, values: Record<string, unknown>) {
            const { error } = await adminClient.from("ai_runs").update(values).eq("id", id);
            if (error) throw new Error("AI_RUN_UPDATE_FAILED");
        },
        async reconcileAIRun(messageId: string, task: string) {
            const { error } = await adminClient.from("ai_runs").update({ status: "succeeded", error_code: null, completed_at: new Date().toISOString() }).eq("user_message_id", messageId).eq("task", task);
            if (error) throw new Error("AI_RUN_UPDATE_FAILED");
        },
    };
}

export type MirrorDataRepository = ReturnType<typeof createMirrorRepository>;
