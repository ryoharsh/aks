import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/types/database";
import type { Page, PageOptions, Reflection } from "@/types/data";
import { requireAuthenticatedUser, throwDataError } from "./data.repository";
import { pageRange } from "./pagination";

type Row = Database["public"]["Tables"]["reflections"]["Row"];
const mapReflection = (row: Row): Reflection => ({ id: row.id, content: row.content, metadata: row.metadata, createdAt: row.created_at });

export const reflectionsRepository = {
    async create(content: string, metadata: Json = {}) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.from("reflections").insert({ content: content.trim(), metadata }).select().single();
        if (error) throwDataError(error, "We couldn't save that reflection.");
        return mapReflection(data);
    },
    async get(id: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.from("reflections").select().eq("id", id).maybeSingle();
        if (error) throwDataError(error);
        return data ? mapReflection(data) : null;
    },
    async list(options: PageOptions = {}): Promise<Page<Reflection>> {
        await requireAuthenticatedUser();
        const { from, to, pageSize } = pageRange(options.page, options.pageSize);
        const { data, error } = await supabase.from("reflections").select().order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to + 1);
        if (error) throwDataError(error);
        return { items: data.slice(0, pageSize).map(mapReflection), hasMore: data.length > pageSize };
    },
};
