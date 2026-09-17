import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import type { ExistingPattern, PatternProposal, PatternSignal, PatternStatus } from "./pattern.types.ts";

function stableValue(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return JSON.stringify(value);
    return JSON.stringify(Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))));
}

export function createPatternRepository(userClient: SupabaseClient, adminClient: SupabaseClient, userId: string) {
    return {
        async countSignals(signalTypes: string[], before: string) {
            const counts = await Promise.all(signalTypes.map(async (signalType) => {
                const { count, error } = await userClient.from("signals").select("id", { count: "exact", head: true }).eq("signal_type", signalType).lte("observed_at", before);
                if (error) throw new Error("PATTERN_CONTEXT_UNAVAILABLE");
                return [signalType, count ?? 0] as const;
            }));
            return Object.fromEntries(counts) as Record<string, number>;
        },
        async getRecentSignals(signalTypes: string[], before: string): Promise<PatternSignal[]> {
            const batches = await Promise.all(signalTypes.slice(0, 6).map(async (signalType) => {
                const { data, error } = await userClient.from("signals").select("id, source_type, source_id, source_message_id, signal_type, value, observed_at").eq("signal_type", signalType).lte("observed_at", before).order("observed_at", { ascending: false }).limit(6);
                if (error) throw new Error("PATTERN_CONTEXT_UNAVAILABLE");
                return data;
            }));
            const rows = batches.flat();
            const messageIds = [...new Set(rows.flatMap((signal) => signal.source_message_id ? [signal.source_message_id] : []))];
            const excerpts = new Map<string, string>();
            if (messageIds.length) {
                const { data, error } = await userClient.from("messages").select("id, content").in("id", messageIds);
                if (error) throw new Error("PATTERN_CONTEXT_UNAVAILABLE");
                data.forEach((message) => excerpts.set(message.id, message.content.slice(0, 500)));
            }
            return rows.map((signal) => ({ id: signal.id, signalType: signal.signal_type, value: signal.value, conceptKey: `${signal.signal_type}:${stableValue(signal.value)}`, observedAt: signal.observed_at, sourceKey: signal.source_message_id ? `message:${signal.source_message_id}` : `${signal.source_type}:${signal.source_id}`, sourceExcerpt: signal.source_message_id ? excerpts.get(signal.source_message_id) ?? null : null }));
        },
        async getExistingPatterns(): Promise<ExistingPattern[]> {
            const { data, error } = await userClient.from("patterns").select("id, title, description, canonical_key, status, confidence, evidence_count, metadata").neq("status", "archived").order("updated_at", { ascending: false }).limit(12);
            if (error) throw new Error("PATTERN_CONTEXT_UNAVAILABLE");
            return data.flatMap((pattern) => {
                if (!pattern.metadata || typeof pattern.metadata !== "object" || Array.isArray(pattern.metadata)) return [];
                const relationship = pattern.metadata.relationship;
                const conceptKeys = pattern.metadata.concept_keys;
                if ((relationship !== "recurrence" && relationship !== "association" && relationship !== "sequence") || !Array.isArray(conceptKeys) || !conceptKeys.every((key) => typeof key === "string")) return [];
                return [{ id: pattern.id, title: pattern.title, description: pattern.description, canonicalKey: pattern.canonical_key, status: pattern.status, confidence: pattern.confidence, evidenceCount: pattern.evidence_count, relationship, conceptKeys }];
            });
        },
        async getRelevantMemories() {
            const { data, error } = await userClient.from("memories").select("content, memory_type, last_observed_at").eq("status", "active").order("last_observed_at", { ascending: false }).limit(6);
            if (error) throw new Error("PATTERN_CONTEXT_UNAVAILABLE");
            return data.map((memory) => ({ content: memory.content, memoryType: memory.memory_type, lastObservedAt: memory.last_observed_at }));
        },
        async claimRun(input: { conversationId: string; userMessageId: string }) {
            const { data, error } = await adminClient.rpc("claim_ai_run", { run_user_id: userId, run_conversation_id: input.conversationId, run_user_message_id: input.userMessageId, run_task: "pattern_analysis" });
            if (error || !data) throw new Error(error?.message?.includes("MIRROR_RATE_LIMITED") ? "RATE_LIMITED" : "PATTERN_RUN_UNAVAILABLE");
            return data as { id: string; status: string };
        },
        async updateRun(id: string, values: Record<string, unknown>) {
            const { error } = await adminClient.from("ai_runs").update(values).eq("id", id).or("error_code.is.null,error_code.neq.USER_PATTERN_RESET");
            if (error) throw new Error("PATTERN_RUN_UPDATE_FAILED");
        },
        async applyProposal(input: { runId: string; targetPatternId: string | null; proposal: PatternProposal; title: string; description: string; canonicalKey: string; status: Exclude<PatternStatus, "testing" | "archived">; confidence: number; signalIds: string[]; evidenceRelationship: "supporting" | "contradicting"; relationship: string; conceptKeys: string[]; reason: string }) {
            const { data, error } = await adminClient.rpc("apply_pattern_analysis", { pattern_user_id: userId, target_pattern_id: input.targetPatternId, analyzed_title: input.title, analyzed_description: input.description, analyzed_canonical_key: input.canonicalKey, analyzed_status: input.status, analyzed_confidence: input.confidence, analyzed_metadata: { relationship: input.relationship, concept_keys: input.conceptKeys, reason: input.reason, alternative_explanation: input.relationship === "recurrence" ? null : "Other context may also explain this relationship.", task_version: "pattern_analysis_v1" }, evidence_signal_ids: input.signalIds, evidence_relationship: input.evidenceRelationship, analysis_run_id: input.runId });
            if (error?.message?.includes("PATTERN_ANALYSIS_SUPPRESSED")) return { action: "no_action" as const };
            if (error || !data) throw new Error("PATTERN_PERSISTENCE_FAILED");
            return data as { action: "created" | "updated"; patternId: string; status: PatternStatus };
        },
    };
}

export type PatternRepository = ReturnType<typeof createPatternRepository>;
