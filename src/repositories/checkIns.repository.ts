import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/types/database";
import type { CheckIn, Page, PageOptions } from "@/types/data";
import { copy } from "@/constants/copy";
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

export function createCheckInRequestId() {
    return globalThis.crypto?.randomUUID?.() ?? `checkin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const checkInsRepository = {
    async create(values: CreateCheckIn, requestId?: string) {
        const user = await requireAuthenticatedUser();
        const { data, error } = await supabase.rpc("create_check_in", {
            check_in_user_id: user.id,
            check_in_values: {
                mood: values.mood ?? null,
                energy: values.energy ?? null,
                focus: values.focus ?? null,
                stress: values.stress ?? null,
                notes: values.notes ?? null,
                metadata: values.metadata ?? {},
            },
            request_id: requestId ?? createCheckInRequestId(),
        });
        if (error) throwDataError(error, copy.errors.writes.checkIn);
        const saved = data as { id: string; created_at: string } | null;
        if (!saved?.id) throwDataError(new Error("Missing check-in result"), copy.errors.writes.checkIn);
        return mapCheckIn({
            id: saved.id,
            user_id: user.id,
            mood: values.mood ?? null,
            energy: values.energy ?? null,
            focus: values.focus ?? null,
            stress: values.stress ?? null,
            notes: values.notes ?? null,
            client_request_id: requestId ?? null,
            metadata: values.metadata ?? {},
            created_at: saved.created_at,
        });
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
