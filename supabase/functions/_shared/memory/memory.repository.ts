import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import type { ExistingMemory, MemoryEvaluation, MemorySignalEvidence, MemoryStatus } from "./memory.types.ts";

export function createMemoryRepository(userClient: SupabaseClient, adminClient: SupabaseClient, userId: string) {
    return {
        async getSupportingSignals(signalTypes: string[], before: string): Promise<MemorySignalEvidence[]> {
            if (!signalTypes.length) return [];
            const { data, error } = await userClient.from("signals").select("id, signal_type, value, confidence, observed_at, source_message_id").in("signal_type", signalTypes).lte("observed_at", before).order("observed_at", { ascending: false }).limit(12);
            if (error) throw new Error("MEMORY_CONTEXT_UNAVAILABLE");
            const messageIds = [...new Set(data.flatMap((signal) => signal.source_message_id ? [signal.source_message_id] : []))];
            const excerpts = new Map<string, string>();
            if (messageIds.length) {
                const { data: messages, error: messageError } = await userClient.from("messages").select("id, content").in("id", messageIds);
                if (messageError) throw new Error("MEMORY_CONTEXT_UNAVAILABLE");
                messages.forEach((message) => excerpts.set(message.id, message.content.slice(0, 600)));
            }
            return data.map((signal) => ({ id: signal.id, signalType: signal.signal_type, value: signal.value, confidence: signal.confidence, observedAt: signal.observed_at, sourceMessageId: signal.source_message_id, sourceExcerpt: signal.source_message_id ? excerpts.get(signal.source_message_id) ?? null : null }));
        },
        async getExistingMemories(): Promise<ExistingMemory[]> {
            const { data, error } = await userClient.from("memories").select("id, memory_type, content, status, confidence, evidence_count, last_observed_at, metadata").in("status", ["candidate", "active"]).order("updated_at", { ascending: false }).limit(12);
            if (error) throw new Error("MEMORY_CONTEXT_UNAVAILABLE");
            return data.map((memory) => ({ id: memory.id, memoryType: memory.memory_type, content: memory.content, status: memory.status, confidence: memory.confidence, evidenceCount: memory.evidence_count, lastObservedAt: memory.last_observed_at, canonicalKey: memory.metadata && typeof memory.metadata === "object" && !Array.isArray(memory.metadata) && typeof memory.metadata.canonical_key === "string" ? memory.metadata.canonical_key : null }));
        },
        async getActiveMemories() {
            const { data, error } = await userClient.from("memories").select("content, memory_type, last_observed_at").eq("status", "active").order("last_observed_at", { ascending: false }).limit(6);
            if (error) throw new Error("MEMORY_CONTEXT_UNAVAILABLE");
            return data.map((memory) => ({ content: memory.content, memoryType: memory.memory_type, lastObservedAt: memory.last_observed_at }));
        },
        async claimRun(input: { conversationId: string; userMessageId: string }) {
            const { data, error } = await adminClient.rpc("claim_ai_run", { run_user_id: userId, run_conversation_id: input.conversationId, run_user_message_id: input.userMessageId, run_task: "memory_evaluation" });
            if (error || !data) throw new Error(error?.message?.includes("MIRROR_RATE_LIMITED") ? "RATE_LIMITED" : "MEMORY_RUN_UNAVAILABLE");
            return data as { id: string; status: string };
        },
        async updateRun(id: string, values: Record<string, unknown>) {
            const { error } = await adminClient.from("ai_runs").update(values).eq("id", id).or("error_code.is.null,error_code.neq.USER_MEMORY_RESET");
            if (error) throw new Error("MEMORY_RUN_UPDATE_FAILED");
        },
        async applyEvaluation(input: { runId: string; targetMemoryId: string | null; evaluation: MemoryEvaluation; status: Exclude<MemoryStatus, "archived">; confidence: number; evidenceSignalIds: string[]; normalizedContent: string; canonicalKey: string; version: string }) {
            const { data, error } = await adminClient.rpc("apply_memory_evaluation", {
                memory_user_id: userId,
                target_memory_id: input.targetMemoryId,
                evaluated_memory_type: input.evaluation.memory.type,
                evaluated_content: input.evaluation.memory.content,
                evaluated_normalized_content: input.normalizedContent,
                evaluated_status: input.status,
                evaluated_confidence: input.confidence,
                evaluated_metadata: { reason: input.evaluation.reason, canonical_key: input.canonicalKey, task_version: input.version },
                evidence_signal_ids: input.evidenceSignalIds,
                evaluation_run_id: input.runId,
            });
            if (error?.message?.includes("MEMORY_EVALUATION_SUPPRESSED")) return { action: "no_action" as const };
            if (error || !data) throw new Error("MEMORY_PERSISTENCE_FAILED");
            return data as { action: "created" | "updated"; memoryId: string; status: MemoryStatus };
        },
    };
}

export type MemoryRepository = ReturnType<typeof createMemoryRepository>;
