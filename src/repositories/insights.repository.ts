import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import type { Insight, Page, PageOptions } from "@/types/data";
import { copy } from "@/constants/copy";
import { requireAuthenticatedUser, throwDataError } from "./data.repository";
import { pageRange } from "./pagination";

type Row = Database["public"]["Tables"]["insights"]["Row"];
const mapInsight = (row: Row): Insight => ({ id: row.id, type: row.type, title: row.title, content: row.content, patternId: row.pattern_id, experimentId: row.experiment_id, learningId: row.learning_id, confidence: row.confidence, status: row.status, seenAt: row.seen_at, metadata: row.metadata, createdAt: row.created_at, updatedAt: row.updated_at });

async function mutate(functionName: "mark_insight_seen" | "dismiss_insight" | "archive_insight" | "delete_insight", id: string) {
    await requireAuthenticatedUser();
    const { error } = await supabase.rpc(functionName, { target_insight_id: id });
    if (error) throwDataError(error, copy.errors.writes.insightUpdate);
}

export const insightsRepository = {
    async list(options: PageOptions = {}): Promise<Page<Insight>> {
        await requireAuthenticatedUser();
        const { from, to, pageSize } = pageRange(options.page, options.pageSize);
        const { data, error } = await supabase.from("insights").select().in("status", ["new", "seen"]).order("status", { ascending: true }).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to + 1);
        if (error) throwDataError(error);
        return { items: data.slice(0, pageSize).map(mapInsight), hasMore: data.length > pageSize };
    },
    async get(id: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.from("insights").select().eq("id", id).maybeSingle();
        if (error) throwDataError(error);
        return data ? mapInsight(data) : null;
    },
    async getSources(insight: Insight) {
        const [learning, experiment, pattern] = await Promise.all([
            insight.learningId ? supabase.from("learnings").select("id, title, description, evidence_count").eq("id", insight.learningId).maybeSingle() : Promise.resolve({ data: null, error: null }),
            insight.experimentId ? supabase.from("experiments").select("id, title, result, result_summary, observation_count").eq("id", insight.experimentId).maybeSingle() : Promise.resolve({ data: null, error: null }),
            insight.patternId ? supabase.from("patterns").select("id, title, description, evidence_count").eq("id", insight.patternId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        ]);
        if (learning.error || experiment.error || pattern.error) throwDataError(learning.error ?? experiment.error ?? pattern.error);
        return { learning: learning.data, experiment: experiment.data, pattern: pattern.data };
    },
    markSeen: (id: string) => mutate("mark_insight_seen", id),
    dismiss: (id: string) => mutate("dismiss_insight", id),
    archive: (id: string) => mutate("archive_insight", id),
    delete: (id: string) => mutate("delete_insight", id),
};
