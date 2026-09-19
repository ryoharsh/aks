// Notification candidates from real Aks domain events. These helpers are the
// ONLY way domain state becomes a notification candidate; they never call
// OneSignal directly and never change how Aks generates insights/experiments.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type EventCandidate = {
    userId: string;
    category: "insights" | "experiments" | "checkIns" | "weekly";
    sourceType: string;
    sourceId: string | null;
    eventKey: string;
    title: string;
    body: string;
    route: string | null;
};

/** Calibrated, evidence-honest notification copy. No percentages, no streaks. */
export function insightCandidate(userId: string, insight: { id: string; title: string; content: string }): EventCandidate {
    return {
        userId,
        category: "insights",
        sourceType: "insight",
        sourceId: insight.id,
        eventKey: `insight:${insight.id}`,
        title: "I noticed something.",
        body: insight.title.slice(0, 140),
        route: "InsightDetail",
    };
}

export function experimentStartedCandidate(userId: string, experiment: { id: string; title: string }): EventCandidate {
    return {
        userId,
        category: "experiments",
        sourceType: "experiment",
        sourceId: experiment.id,
        eventKey: `experiment:${experiment.id}:started`,
        title: "Experiment started",
        body: experiment.title.slice(0, 140),
        route: "ExperimentDetail",
    };
}

export function experimentEndingCandidate(userId: string, experiment: { id: string; title: string; endDate: string }): EventCandidate {
    return {
        userId,
        category: "experiments",
        sourceType: "experiment",
        sourceId: experiment.id,
        eventKey: `experiment:${experiment.id}:ending`,
        title: "Your experiment is wrapping up",
        body: experiment.title.slice(0, 140),
        route: "ExperimentDetail",
    };
}

export function experimentCompletedCandidate(userId: string, experiment: { id: string; title: string }): EventCandidate {
    return {
        userId,
        category: "experiments",
        sourceType: "experiment",
        sourceId: experiment.id,
        eventKey: `experiment:${experiment.id}:completed`,
        title: "Experiment complete",
        body: experiment.title.slice(0, 140),
        route: "ExperimentDetail",
    };
}

export function learningCandidate(userId: string, learning: { id: string; title: string }): EventCandidate {
    return {
        userId,
        category: "experiments",
        sourceType: "learning",
        sourceId: learning.id,
        eventKey: `learning:${learning.id}`,
        title: "A learning from your experiment",
        body: learning.title.slice(0, 140),
        route: "LearningDetail",
    };
}

/** Fetches the active experiment that is one day from its end date (for cron use). */
export async function findEndingExperiments(admin: SupabaseClient): Promise<Array<{ id: string; user_id: string; title: string; end_date: string }>> {
    const { data, error } = await admin
        .from("experiments")
        .select("id, user_id, title, end_date")
        .eq("status", "active")
        .not("end_date", "is", "null")
        .limit(200);
    if (error) throw new Error(error.message);
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 86400000);
    const iso = (date: Date) => date.toISOString().slice(0, 10);
    return (data ?? []).filter((row) => row.end_date === iso(tomorrow) || row.end_date === iso(today));
}
