import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import type { ExperimentMetrics, ExperimentResult, StoredExperiment, StoredObservation } from "./experiment.types.ts";

function mapExperiment(row: Record<string, any>): StoredExperiment {
    return { id: row.id, patternId: row.pattern_id, title: row.title, hypothesis: row.hypothesis, description: row.description, status: row.status, startDate: row.start_date, endDate: row.end_date, result: row.result, resultSummary: row.result_summary, confidence: row.confidence, observationCount: row.observation_count, metadata: row.metadata ?? {}, createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at, learningStatus: row.learning_status, insightStatus: row.insight_status };
}

export function createExperimentRepository(userClient: SupabaseClient, adminClient: SupabaseClient, userId: string) {
    return {
        async getPattern(id: string) {
            const { data, error } = await userClient.from("patterns").select("id, title, description, status").eq("id", id).single();
            if (error || data.status === "archived" || data.status === "not_supported") throw new Error("PATTERN_UNAVAILABLE");
            return data;
        },
        async findOpenForPattern(patternId: string) {
            const { data, error } = await userClient.from("experiments").select("*").eq("pattern_id", patternId).in("status", ["draft", "active"]).maybeSingle();
            if (error) throw new Error("EXPERIMENT_UNAVAILABLE");
            return data ? mapExperiment(data) : null;
        },
        async createDraft(input: { patternId: string; title: string; hypothesis: string; description: string; durationDays: number }) {
            const { data, error } = await adminClient.from("experiments").insert({ user_id: userId, pattern_id: input.patternId, title: input.title, hypothesis: input.hypothesis, description: input.description, metadata: { duration_days: input.durationDays, measurement: "easier_same_harder", observation_prompt: "How did it feel this time?" } }).select("*").single();
            if (error) {
                const existing = await this.findOpenForPattern(input.patternId);
                if (existing) return existing;
                throw new Error("EXPERIMENT_PERSISTENCE_FAILED");
            }
            return mapExperiment(data);
        },
        async getExperiment(id: string) {
            const { data, error } = await userClient.from("experiments").select("*").eq("id", id).single();
            if (error) throw new Error("EXPERIMENT_UNAVAILABLE");
            return mapExperiment(data);
        },
        async listObservations(experimentId: string): Promise<StoredObservation[]> {
            const { data, error } = await userClient.from("experiment_observations").select("*").eq("experiment_id", experimentId).order("observed_at", { ascending: true }).order("id", { ascending: true });
            if (error) throw new Error("EXPERIMENT_UNAVAILABLE");
            return data.map((row) => ({ id: row.id, experimentId: row.experiment_id, value: row.value, notes: row.notes, observedAt: row.observed_at, createdAt: row.created_at }));
        },
        async start(id: string) {
            const { error } = await adminClient.rpc("start_experiment", { experiment_user_id: userId, target_experiment_id: id });
            if (error) throw new Error("EXPERIMENT_TRANSITION_FAILED");
            return this.getExperiment(id);
        },
        async record(id: string, value: Record<string, unknown>, notes: string | null, requestId: string) {
            const { data, error } = await adminClient.rpc("record_experiment_observation", { experiment_user_id: userId, target_experiment_id: id, observation_value: value, observation_notes: notes, request_id: requestId });
            if (error || !data) throw new Error("OBSERVATION_PERSISTENCE_FAILED");
            return data as { id: string; observedAt: string };
        },
        async finish(id: string) {
            const { error } = await adminClient.rpc("finish_experiment", { experiment_user_id: userId, target_experiment_id: id });
            if (error) throw new Error("EXPERIMENT_TRANSITION_FAILED");
            return this.getExperiment(id);
        },
        async cancel(id: string) {
            const { data, error } = await adminClient.rpc("cancel_experiment", { experiment_user_id: userId, target_experiment_id: id });
            if (error || !data) throw new Error("EXPERIMENT_TRANSITION_FAILED");
            return this.getExperiment(id);
        },
        async saveOutcome(id: string, input: { result: ExperimentResult; summary: string; confidence: number | null; metrics: ExperimentMetrics; interpretation: string | null; analysisStatus: "pending" | "not_needed" | "succeeded" | "failed" }) {
            const { data, error } = await adminClient.rpc("save_experiment_outcome", { experiment_user_id: userId, target_experiment_id: id, outcome_result: input.result, outcome_summary: input.summary, outcome_confidence: input.confidence, outcome_metrics: input.metrics, outcome_interpretation: input.interpretation, outcome_analysis_status: input.analysisStatus });
            if (error || !data) throw new Error("EXPERIMENT_OUTCOME_FAILED");
            return mapExperiment(data);
        },
        async claimAnalysis(id: string) {
            const { data, error } = await adminClient.rpc("claim_experiment_ai_run", { run_user_id: userId, run_experiment_id: id });
            if (error || !data) throw new Error(error?.message?.includes("IN_PROGRESS") ? "RATE_LIMITED" : "EXPERIMENT_ANALYSIS_UNAVAILABLE");
            return data as { id: string; status: string };
        },
        async updateRun(id: string, values: Record<string, unknown>) {
            const { error } = await adminClient.from("ai_runs").update(values).eq("id", id);
            if (error) throw new Error("EXPERIMENT_ANALYSIS_UPDATE_FAILED");
        },
        async delete(id: string) {
            const { data, error } = await adminClient.rpc("delete_experiment", { experiment_user_id: userId, target_experiment_id: id });
            if (error || !data) throw new Error("EXPERIMENT_DELETE_FAILED");
        },
    };
}

export type ExperimentRepository = ReturnType<typeof createExperimentRepository>;
