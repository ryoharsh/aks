import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import type { Learning, LearningEvidence, Page, PageOptions } from "@/types/data";
import { copy } from "@/constants/copy";
import { requireAuthenticatedUser, throwDataError } from "./data.repository";
import { pageRange } from "./pagination";

type Row = Database["public"]["Tables"]["learnings"]["Row"];
const mapLearning = (row: Row): Learning => ({ id: row.id, title: row.title, description: row.description, confidence: row.confidence, evidenceCount: row.evidence_count, sourceExperimentId: row.source_experiment_id, status: row.status, metadata: row.metadata, createdAt: row.created_at, updatedAt: row.updated_at });

export const learningsRepository = {
    async list(options: PageOptions = {}): Promise<Page<Learning>> {
        await requireAuthenticatedUser();
        const { from, to, pageSize } = pageRange(options.page, options.pageSize);
        const { data, error } = await supabase.from("learnings").select().in("status", ["active", "revised"]).order("updated_at", { ascending: false }).order("id", { ascending: false }).range(from, to + 1);
        if (error) throwDataError(error);
        return { items: data.slice(0, pageSize).map(mapLearning), hasMore: data.length > pageSize };
    },
    async get(id: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.from("learnings").select().eq("id", id).maybeSingle();
        if (error) throwDataError(error);
        return data ? mapLearning(data) : null;
    },
    async listEvidence(learningId: string): Promise<LearningEvidence[]> {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.from("learning_evidence").select().eq("learning_id", learningId).order("observed_at", { ascending: false });
        if (error) throwDataError(error);
        const experimentIds = data.map((item) => item.experiment_id);
        if (!experimentIds.length) return [];
        const { data: experiments, error: experimentError } = await supabase.from("experiments").select("id, title, result, result_summary, observation_count").in("id", experimentIds);
        if (experimentError) throwDataError(experimentError);
        const experimentMap = new Map(experiments.map((experiment) => [experiment.id, experiment]));
        return data.flatMap((item) => {
            const experiment = experimentMap.get(item.experiment_id);
            if (!experiment?.result || !experiment.result_summary) return [];
            return [{ id: item.id, learningId: item.learning_id, experimentId: item.experiment_id, relationship: item.relationship, observedAt: item.observed_at, createdAt: item.created_at, experimentTitle: experiment.title, result: experiment.result, resultSummary: experiment.result_summary, observationCount: experiment.observation_count }];
        });
    },
    async archive(id: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.rpc("archive_learning", { target_learning_id: id });
        if (error || !data) throwDataError(error, copy.errors.writes.archiveLearning);
    },
    async delete(id: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.rpc("delete_learning", { target_learning_id: id });
        if (error || !data) throwDataError(error, copy.errors.writes.removeLearning);
    },
};
