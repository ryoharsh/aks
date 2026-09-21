import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/types/database";
import type { Page, PageOptions, Signal, SignalSourceType } from "@/types/data";
import { copy } from "@/constants/copy";
import { requireAuthenticatedUser, throwDataError } from "./data.repository";
import { pageRange } from "./pagination";

type Row = Database["public"]["Tables"]["signals"]["Row"];
const mapSignal = (row: Row): Signal => ({ id: row.id, sourceType: row.source_type, sourceId: row.source_id, sourceMessageId: row.source_message_id, signalType: row.signal_type, value: row.value, confidence: row.confidence, observedAt: row.observed_at, createdAt: row.created_at });

export const signalsRepository = {
    async create(values: { sourceType: SignalSourceType; sourceId: string; sourceMessageId?: string | null; signalType: string; value: Json; confidence?: number | null; observedAt: string }) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.from("signals").insert({ source_type: values.sourceType, source_id: values.sourceId, source_message_id: values.sourceMessageId, signal_type: values.signalType.trim(), value: values.value, confidence: values.confidence, observed_at: values.observedAt }).select().single();
        if (error) throwDataError(error, copy.errors.writes.observation);
        return mapSignal(data);
    },
    async get(id: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.from("signals").select().eq("id", id).maybeSingle();
        if (error) throwDataError(error);
        return data ? mapSignal(data) : null;
    },
    async list(options: PageOptions = {}): Promise<Page<Signal>> {
        await requireAuthenticatedUser();
        const { from, to, pageSize } = pageRange(options.page, options.pageSize);
        const { data, error } = await supabase.from("signals").select().order("observed_at", { ascending: false }).order("id", { ascending: false }).range(from, to + 1);
        if (error) throwDataError(error);
        return { items: data.slice(0, pageSize).map(mapSignal), hasMore: data.length > pageSize };
    },
};
