import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import type { Memory, MemoryEvidence, Page, PageOptions } from "@/types/data";
import { copy } from "@/constants/copy";
import { requireAuthenticatedUser, throwDataError } from "./data.repository";
import { pageRange } from "./pagination";

type MemoryRow = Database["public"]["Tables"]["memories"]["Row"];
type EvidenceRow = Database["public"]["Tables"]["memory_evidence"]["Row"];

const mapMemory = (row: MemoryRow): Memory => ({ id: row.id, memoryType: row.memory_type, content: row.content, status: row.status, confidence: row.confidence, evidenceCount: row.evidence_count, firstObservedAt: row.first_observed_at, lastObservedAt: row.last_observed_at, metadata: row.metadata, createdAt: row.created_at, updatedAt: row.updated_at });

export const memoriesRepository = {
    async list(options: PageOptions = {}): Promise<Page<Memory>> {
        await requireAuthenticatedUser();
        const { from, to, pageSize } = pageRange(options.page, options.pageSize);
        const { data, error } = await supabase.from("memories").select().eq("status", "active").order("last_observed_at", { ascending: false }).order("id", { ascending: false }).range(from, to + 1);
        if (error) throwDataError(error);
        return { items: data.slice(0, pageSize).map(mapMemory), hasMore: data.length > pageSize };
    },
    async get(id: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.from("memories").select().eq("id", id).maybeSingle();
        if (error) throwDataError(error);
        return data ? mapMemory(data) : null;
    },
    async listEvidence(memoryId: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.from("memory_evidence").select().eq("memory_id", memoryId).order("observed_at", { ascending: false }).limit(50);
        if (error) throwDataError(error);
        const signalIds = data.flatMap((item) => item.signal_id ? [item.signal_id] : []);
        const { data: signalRows, error: signalError } = signalIds.length
            ? await supabase.from("signals").select("id, source_type, source_id, source_message_id, signal_type").in("id", signalIds)
            : { data: [], error: null };
        if (signalError) throwDataError(signalError);
        const signals = new Map(signalRows.map((signal) => [signal.id, signal]));
        const messageIds = [...new Set(data.flatMap((item) => item.message_id ? [item.message_id] : []).concat(signalRows.flatMap((signal) => signal.source_message_id ? [signal.source_message_id] : [])))];
        const reflectionIds = data.flatMap((item) => item.reflection_id ? [item.reflection_id] : []);
        const checkInIds = data.flatMap((item) => item.check_in_id ? [item.check_in_id] : []);
        const [messageResult, reflectionResult, checkInResult] = await Promise.all([
            messageIds.length ? supabase.from("messages").select("id, content").in("id", messageIds) : Promise.resolve({ data: [], error: null }),
            reflectionIds.length ? supabase.from("reflections").select("id, content").in("id", reflectionIds) : Promise.resolve({ data: [], error: null }),
            checkInIds.length ? supabase.from("check_ins").select("id, notes, mood").in("id", checkInIds) : Promise.resolve({ data: [], error: null }),
        ]);
        if (messageResult.error || reflectionResult.error || checkInResult.error) throwDataError(messageResult.error ?? reflectionResult.error ?? checkInResult.error);
        const messages = new Map(messageResult.data.map((row) => [row.id, row.content]));
        const reflections = new Map(reflectionResult.data.map((row) => [row.id, row.content]));
        const checkIns = new Map(checkInResult.data.map((row) => [row.id, row.notes ?? row.mood]));
        return data.map((row): MemoryEvidence => {
            const signal = row.signal_id ? signals.get(row.signal_id) : undefined;
            const sourceType = signal?.source_type ?? (row.message_id ? "message" : row.reflection_id ? "reflection" : row.check_in_id ? "check_in" : "unknown");
            const sourceId = signal?.source_id ?? row.message_id ?? row.reflection_id ?? row.check_in_id;
            const excerpt = signal?.source_message_id ? messages.get(signal.source_message_id) : row.message_id ? messages.get(row.message_id) : row.reflection_id ? reflections.get(row.reflection_id) : row.check_in_id ? checkIns.get(row.check_in_id) : null;
            return { id: row.id, memoryId: row.memory_id, signalId: row.signal_id, messageId: row.message_id, reflectionId: row.reflection_id, checkInId: row.check_in_id, observedAt: row.observed_at, createdAt: row.created_at, sourceType, sourceId, signalType: signal?.signal_type ?? null, sourceExcerpt: excerpt?.slice(0, 300) ?? null };
        });
    },
    async archive(id: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.rpc("archive_memory", { target_memory_id: id });
        if (error || !data) throwDataError(error, copy.errors.writes.archiveMemory);
    },
    async delete(id: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.rpc("delete_memory", { target_memory_id: id });
        if (error || !data) throwDataError(error, copy.errors.writes.removeMemory);
    },
};
