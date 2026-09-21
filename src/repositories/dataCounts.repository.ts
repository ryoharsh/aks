import { supabase } from "@/lib/supabase";
import type { YourDataCounts } from "@/types/data";
import { requireAuthenticatedUser, throwDataError } from "./data.repository";

async function count(table: "conversations" | "reflections" | "check_ins") {
    const { count: total, error } = await supabase.from(table).select("id", { count: "exact", head: true });
    if (error) throwDataError(error);
    return total ?? 0;
}

async function countActiveMemories() {
    const { count: total, error } = await supabase.from("memories").select("id", { count: "exact", head: true }).eq("status", "active");
    if (error) throwDataError(error);
    return total ?? 0;
}

async function countPatterns() {
    const { count: total, error } = await supabase.from("patterns").select("id", { count: "exact", head: true }).neq("status", "archived");
    if (error) throwDataError(error);
    return total ?? 0;
}

async function countExperiments() {
    const { count: total, error } = await supabase.from("experiments").select("id", { count: "exact", head: true });
    if (error) throwDataError(error);
    return total ?? 0;
}

async function countLearnings() {
    const { count: total, error } = await supabase.from("learnings").select("id", { count: "exact", head: true }).in("status", ["active", "revised"]);
    if (error) throwDataError(error);
    return total ?? 0;
}

async function countInsights() {
    const { count: total, error } = await supabase.from("insights").select("id", { count: "exact", head: true }).in("status", ["new", "seen"]);
    if (error) throwDataError(error);
    return total ?? 0;
}

/**
 * Connected sources come from the canonical personal-context registry
 * (`user_data_sources`), the same table the source control center reads and
 * writes. Never inferred from any other table.
 */
async function countConnectedSources() {
    const { count: total, error } = await supabase.from("user_data_sources").select("id", { count: "exact", head: true }).eq("status", "connected");
    if (error) throwDataError(error);
    return total ?? 0;
}

export const dataCountsRepository = {
    async get(): Promise<YourDataCounts> {
        await requireAuthenticatedUser();
        const [conversations, reflections, checkIns, memories, patterns, experiments, learnings, insights, connectedSources] = await Promise.all([
            count("conversations"),
            count("reflections"),
            count("check_ins"),
            countActiveMemories(),
            countPatterns(),
            countExperiments(),
            countLearnings(),
            countInsights(),
            countConnectedSources(),
        ]);
        return { conversations, reflections, checkIns, memories, patterns, experiments, learnings, insights, connectedSources };
    },
};
