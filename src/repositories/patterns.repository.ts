import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import type { Page, PageOptions, Pattern, PatternEvidence } from "@/types/data";
import { requireAuthenticatedUser, throwDataError } from "./data.repository";
import { pageRange } from "./pagination";

type PatternRow = Database["public"]["Tables"]["patterns"]["Row"];
const mapPattern = (row: PatternRow): Pattern => ({ id: row.id, title: row.title, description: row.description, status: row.status, confidence: row.confidence, evidenceCount: row.evidence_count, firstDetectedAt: row.first_detected_at, lastObservedAt: row.last_observed_at, metadata: row.metadata, createdAt: row.created_at, updatedAt: row.updated_at });

export const patternsRepository = {
    async list(options: PageOptions = {}): Promise<Page<Pattern>> {
        await requireAuthenticatedUser();
        const { from, to, pageSize } = pageRange(options.page, options.pageSize);
        const { data, error } = await supabase.from("patterns").select().neq("status", "archived").order("updated_at", { ascending: false }).order("id", { ascending: false }).range(from, to + 1);
        if (error) throwDataError(error);
        return { items: data.slice(0, pageSize).map(mapPattern), hasMore: data.length > pageSize };
    },
    async get(id: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.from("patterns").select().eq("id", id).maybeSingle();
        if (error) throwDataError(error);
        return data ? mapPattern(data) : null;
    },
    async listEvidence(patternId: string): Promise<PatternEvidence[]> {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.from("pattern_evidence").select().eq("pattern_id", patternId).order("observed_at", { ascending: false }).limit(60);
        if (error) throwDataError(error);
        const signalIds = data.map((item) => item.signal_id);
        if (!signalIds.length) return [];
        const { data: signals, error: signalError } = await supabase.from("signals").select("id, signal_type, source_type, source_id, source_message_id").in("id", signalIds);
        if (signalError) throwDataError(signalError);
        const messageIds = signals.flatMap((signal) => signal.source_message_id ? [signal.source_message_id] : []);
        const { data: messages, error: messageError } = messageIds.length ? await supabase.from("messages").select("id, content").in("id", messageIds) : { data: [], error: null };
        if (messageError) throwDataError(messageError);
        const signalMap = new Map(signals.map((signal) => [signal.id, signal]));
        const excerpts = new Map(messages.map((message) => [message.id, message.content]));
        return data.flatMap((item) => {
            const signal = signalMap.get(item.signal_id);
            if (!signal) return [];
            return [{ id: item.id, patternId: item.pattern_id, signalId: item.signal_id, relationship: item.relationship, observedAt: item.observed_at, createdAt: item.created_at, signalType: signal.signal_type, sourceType: signal.source_type, sourceId: signal.source_id, sourceExcerpt: signal.source_message_id ? excerpts.get(signal.source_message_id)?.slice(0, 300) ?? null : null }];
        });
    },
    async archive(id: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.rpc("archive_pattern", { target_pattern_id: id });
        if (error || !data) throwDataError(error, "We couldn't archive this pattern.");
    },
    async delete(id: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.rpc("delete_pattern", { target_pattern_id: id });
        if (error || !data) throwDataError(error, "We couldn't remove this pattern.");
    },
};
