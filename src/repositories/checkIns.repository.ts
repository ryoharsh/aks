import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/types/database";
import type { CheckIn, Page, PageOptions } from "@/types/data";
import { requireAuthenticatedUser, throwDataError } from "./data.repository";
import { pageRange } from "./pagination";

type Row = Database["public"]["Tables"]["check_ins"]["Row"];
const mapCheckIn = (row: Row): CheckIn => ({ id: row.id, mood: row.mood, energy: row.energy, focus: row.focus, stress: row.stress, notes: row.notes, metadata: row.metadata, createdAt: row.created_at });

export type CreateCheckIn = {
    mood?: string | null;
    energy?: number | null;
    focus?: number | null;
    stress?: number | null;
    notes?: string | null;
    metadata?: Json;
};

export const checkInsRepository = {
    async create(values: CreateCheckIn) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.from("check_ins").insert(values).select().single();
        if (error) throwDataError(error, "We couldn't save that check-in.");
        return mapCheckIn(data);
    },
    async get(id: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.from("check_ins").select().eq("id", id).maybeSingle();
        if (error) throwDataError(error);
        return data ? mapCheckIn(data) : null;
    },
    async list(options: PageOptions = {}): Promise<Page<CheckIn>> {
        await requireAuthenticatedUser();
        const { from, to, pageSize } = pageRange(options.page, options.pageSize);
        const { data, error } = await supabase.from("check_ins").select().order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to + 1);
        if (error) throwDataError(error);
        return { items: data.slice(0, pageSize).map(mapCheckIn), hasMore: data.length > pageSize };
    },
};
