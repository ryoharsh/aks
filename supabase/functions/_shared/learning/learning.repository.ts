import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import type { ExistingLearning, LearningProposal, LearningStatus } from "./learning.types.ts";

export function createLearningRepository(userClient: SupabaseClient, adminClient: SupabaseClient, userId: string) {
    return {
        async getExperiment(id: string) {
            const { data, error } = await userClient.from("experiments").select("*").eq("id", id).single();
            if (error) throw new Error("EXPERIMENT_UNAVAILABLE");
            return data;
        },
        async getObservations(experimentId: string) {
            const { data, error } = await userClient.from("experiment_observations").select("id, value, notes, observed_at").eq("experiment_id", experimentId).order("observed_at", { ascending: true });
            if (error) throw new Error("EXPERIMENT_UNAVAILABLE");
            return data;
        },
        async getPattern(patternId: string | null) {
            if (!patternId) return null;
            const { data, error } = await userClient.from("patterns").select("id, title, description, status").eq("id", patternId).maybeSingle();
            if (error) throw new Error("LEARNING_CONTEXT_UNAVAILABLE");
            return data;
        },
        async getExistingLearnings(): Promise<ExistingLearning[]> {
            const { data, error } = await userClient.from("learnings").select("id, title, description, canonical_key, confidence, evidence_count, status, metadata").in("status", ["active", "revised"]).order("updated_at", { ascending: false }).limit(12);
            if (error) throw new Error("LEARNING_CONTEXT_UNAVAILABLE");
            return data.map((learning) => {
                const metadata = learning.metadata && typeof learning.metadata === "object" && !Array.isArray(learning.metadata) ? learning.metadata : {};
                const counts = metadata.result_counts && typeof metadata.result_counts === "object" && !Array.isArray(metadata.result_counts) ? metadata.result_counts : {};
                return { id: learning.id, title: learning.title, description: learning.description, canonicalKey: learning.canonical_key, confidence: learning.confidence, evidenceCount: learning.evidence_count, status: learning.status, latestResult: metadata.latest_result === "supports" || metadata.latest_result === "mixed" || metadata.latest_result === "does_not_support" ? metadata.latest_result : null, resultCounts: { supports: typeof counts.supports === "number" ? counts.supports : 0, mixed: typeof counts.mixed === "number" ? counts.mixed : 0, doesNotSupport: typeof counts.does_not_support === "number" ? counts.does_not_support : 0 } };
            });
        },
        async findForExperiment(experimentId: string) {
            const { data, error } = await userClient.from("learning_evidence").select("learning_id").eq("experiment_id", experimentId).maybeSingle();
            if (error) throw new Error("LEARNING_CONTEXT_UNAVAILABLE");
            return data?.learning_id ?? null;
        },
        async claimRun(experimentId: string) {
            const { data, error } = await adminClient.rpc("claim_learning_ai_run", { run_user_id: userId, run_experiment_id: experimentId });
            if (error || !data) throw new Error(error?.message?.includes("IN_PROGRESS") || error?.message?.includes("RATE_LIMITED") ? "RATE_LIMITED" : "LEARNING_RUN_UNAVAILABLE");
            return data as { id: string; status: string; attemptToken: string };
        },
        async updateRun(id: string, values: Record<string, unknown>, attemptToken?: string) {
            let query = adminClient.from("ai_runs").update(values).eq("id", id).or("error_code.is.null,error_code.neq.USER_LEARNING_RESET");
            if (attemptToken) query = query.eq("attempt_token", attemptToken);
            const { error } = await query;
            if (error) throw new Error("LEARNING_RUN_UPDATE_FAILED");
        },
        async markExperiment(experimentId: string, status: "pending" | "succeeded" | "failed" | "not_applicable") {
            const { data, error } = await adminClient.rpc("set_experiment_learning_status", { experiment_user_id: userId, target_experiment_id: experimentId, new_status: status });
            if (error || !data) throw new Error("LEARNING_STATUS_FAILED");
        },
        async apply(input: { runId: string; attemptToken: string; targetLearningId: string | null; experimentId: string; proposal: LearningProposal; status: Exclude<LearningStatus, "archived">; confidence: number; relationship: "supports" | "mixed" | "contradicts" }) {
            const { data, error } = await adminClient.rpc("apply_learning_synthesis", { learning_user_id: userId, target_learning_id: input.targetLearningId, source_experiment: input.experimentId, synthesized_title: input.proposal.learning.title, synthesized_description: input.proposal.learning.description, synthesized_canonical_key: input.proposal.learning.key, synthesized_status: input.status, synthesized_confidence: input.confidence, synthesized_metadata: { latest_result: input.relationship === "contradicts" ? "does_not_support" : input.relationship, task_version: "learning_synthesis_v1" }, evidence_experiment_ids: [input.experimentId], evidence_relationship: input.relationship, synthesis_run_id: input.runId, synthesis_attempt_token: input.attemptToken });
            if (error?.message?.includes("LEARNING_SYNTHESIS_SUPPRESSED")) throw new Error("LEARNING_SYNTHESIS_SUPPRESSED");
            if (error || !data) throw new Error("LEARNING_PERSISTENCE_FAILED");
            return data as { action: "created" | "updated"; learningId: string; status: LearningStatus };
        },
    };
}

export type LearningRepository = ReturnType<typeof createLearningRepository>;
