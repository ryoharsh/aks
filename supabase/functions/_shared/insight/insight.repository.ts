import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import type { InsightProposal } from "./insight.types.ts";

export function createInsightRepository(userClient: SupabaseClient, adminClient: SupabaseClient, userId: string) {
    return {
        async getSources(experimentId: string) {
            const { data: link, error: linkError } = await userClient.from("learning_evidence").select("learning_id").eq("experiment_id", experimentId).maybeSingle();
            if (linkError) throw new Error("INSIGHT_CONTEXT_UNAVAILABLE");
            if (!link) return null;
            const [{ data: learning, error: learningError }, { data: experiment, error: experimentError }] = await Promise.all([
                userClient.from("learnings").select("id, title, description, confidence, evidence_count, status, updated_at, metadata").eq("id", link.learning_id).maybeSingle(),
                userClient.from("experiments").select("id, pattern_id, title, result, result_summary, observation_count, confidence, completed_at").eq("id", experimentId).maybeSingle(),
            ]);
            if (learningError || experimentError) throw new Error("INSIGHT_CONTEXT_UNAVAILABLE");
            if (!learning || !experiment) return null;
            const { data: pattern, error: patternError } = experiment.pattern_id ? await userClient.from("patterns").select("id, title, description, confidence, status, updated_at").eq("id", experiment.pattern_id).maybeSingle() : { data: null, error: null };
            if (patternError) throw new Error("INSIGHT_CONTEXT_UNAVAILABLE");
            return { learning, experiment, pattern };
        },
        async getRecentInsights(learningId: string) {
            const { data, error } = await userClient.from("insights").select("id, status, confidence, metadata, created_at").eq("learning_id", learningId).order("created_at", { ascending: false }).limit(5);
            if (error) throw new Error("INSIGHT_CONTEXT_UNAVAILABLE");
            return data;
        },
        async claimRun(experimentId: string) {
            const { data, error } = await adminClient.rpc("claim_insight_ai_run", { run_user_id: userId, run_experiment_id: experimentId });
            if (error || !data) {
                if (error?.message?.includes("ATTEMPTS_EXHAUSTED")) throw new Error("ATTEMPTS_EXHAUSTED");
                throw new Error(error?.message?.includes("IN_PROGRESS") || error?.message?.includes("RATE_LIMITED") ? "RATE_LIMITED" : "INSIGHT_RUN_UNAVAILABLE");
            }
            return data as { id: string; status: string; attemptToken: string };
        },
        async updateRun(id: string, values: Record<string, unknown>, attemptToken: string) {
            const { data, error } = await adminClient.from("ai_runs").update(values).eq("id", id).eq("attempt_token", attemptToken).select("id").maybeSingle();
            if (error) throw new Error("INSIGHT_RUN_UPDATE_FAILED");
            return !!data;
        },
        async markExperiment(experimentId: string, status: "pending" | "succeeded" | "failed" | "exhausted" | "not_applicable") {
            const { data, error } = await adminClient.rpc("set_experiment_insight_status", { experiment_user_id: userId, target_experiment_id: experimentId, new_status: status });
            if (error || !data) throw new Error("INSIGHT_STATUS_FAILED");
        },
        async apply(input: { runId: string; attemptToken: string; proposal: InsightProposal; sourceUpdatedAt: string; sourceEvidenceCount: number; sourceExperimentResult: string; sourceExperimentObservationCount: number; sourcePatternUpdatedAt: string | null }) {
            const { data, error } = await adminClient.rpc("apply_insight_generation", { insight_user_id: userId, source_pattern_id: input.proposal.patternId, source_experiment_id: input.proposal.experimentId, source_learning_id: input.proposal.learningId, insight_type: input.proposal.insight.type, insight_title: input.proposal.insight.title, insight_content: input.proposal.insight.content, insight_confidence: input.proposal.confidence, insight_metadata: { source_updated_at: input.sourceUpdatedAt, source_evidence_count: input.sourceEvidenceCount, task_version: "insight_generation_v1" }, source_learning_updated_at: input.sourceUpdatedAt, source_learning_evidence_count: input.sourceEvidenceCount, source_experiment_result: input.sourceExperimentResult, source_experiment_observation_count: input.sourceExperimentObservationCount, source_pattern_updated_at: input.sourcePatternUpdatedAt, generation_run_id: input.runId, generation_attempt_token: input.attemptToken });
            if (error?.message?.includes("INSIGHT_GENERATION_SUPPRESSED")) throw new Error("INSIGHT_GENERATION_SUPPRESSED");
            if (error || !data) throw new Error("INSIGHT_PERSISTENCE_FAILED");
            return data as { action: "created" | "skipped"; insightId: string };
        },
    };
}

export type InsightRepository = ReturnType<typeof createInsightRepository>;
