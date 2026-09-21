import { supabase, assertSupabaseConfigured } from "@/lib/supabase";
import type { Database, Json } from "@/types/database";
import type { Experiment, ExperimentObservation, Page, PageOptions } from "@/types/data";
import { copy } from "@/constants/copy";
import { requireAuthenticatedUser, throwDataError } from "./data.repository";
import { pageRange } from "./pagination";

type Row = Database["public"]["Tables"]["experiments"]["Row"];
const mapExperiment = (row: Row): Experiment => ({ id: row.id, patternId: row.pattern_id, title: row.title, hypothesis: row.hypothesis, description: row.description, status: row.status, startDate: row.start_date, endDate: row.end_date, result: row.result, resultSummary: row.result_summary, confidence: row.confidence, observationCount: row.observation_count, metadata: row.metadata, createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at, learningStatus: row.learning_status, insightStatus: row.insight_status });

function isExperiment(value: unknown): value is Experiment {
    return !!value && typeof value === "object" && typeof (value as Experiment).id === "string" && typeof (value as Experiment).hypothesis === "string";
}

async function invoke(action: string, body: Record<string, unknown>) {
    assertSupabaseConfigured();
    const { data, error } = await supabase.functions.invoke("experiment", { body: { action, ...body } });
    if (error) throwDataError(error, copy.errors.writes.experimentUpdate);
    return data;
}

export const experimentsRepository = {
    async list(options: PageOptions = {}): Promise<Page<Experiment>> {
        await requireAuthenticatedUser();
        const { from, to, pageSize } = pageRange(options.page, options.pageSize);
        const { data, error } = await supabase.from("experiments").select().order("sort_priority", { ascending: true }).order("updated_at", { ascending: false }).order("id", { ascending: false }).range(from, to + 1);
        if (error) throwDataError(error);
        const items = data.slice(0, pageSize).map(mapExperiment);
        return { items, hasMore: data.length > pageSize };
    },
    async get(id: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.from("experiments").select().eq("id", id).maybeSingle();
        if (error) throwDataError(error);
        return data ? mapExperiment(data) : null;
    },
    async listObservations(experimentId: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.from("experiment_observations").select().eq("experiment_id", experimentId).order("observed_at", { ascending: false }).order("id", { ascending: false });
        if (error) throwDataError(error);
        return data.map((row): ExperimentObservation => ({ id: row.id, experimentId: row.experiment_id, value: row.value, notes: row.notes, observedAt: row.observed_at, createdAt: row.created_at }));
    },
    async action(action: string, body: Record<string, unknown>): Promise<Experiment> {
        const data = await invoke(action, body);
        if (!isExperiment(data)) throwDataError(null, copy.errors.writes.experimentInvalid);
        return data;
    },
    create(input: { patternId: string; title: string; hypothesis: string; description: string; durationDays: number }) {
        return this.action("create", input);
    },
    start(experimentId: string) { return this.action("start", { experimentId }); },
    observe(experimentId: string, value: Json, notes: string | null, requestId: string) { return invoke("observe", { experimentId, value, notes, requestId }); },
    complete(experimentId: string) { return this.action("complete", { experimentId }); },
    retryAnalysis(experimentId: string) { return this.action("retry_analysis", { experimentId }); },
    retryLearning(experimentId: string) { return this.action("retry_learning", { experimentId }); },
    retryInsight(experimentId: string) { return this.action("retry_insight", { experimentId }); },
    cancel(experimentId: string) { return this.action("cancel", { experimentId }); },
    async delete(experimentId: string) { await invoke("delete", { experimentId }); },
};
