import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/types/database";
import type { Conversation, Page, PageOptions } from "@/types/data";
import { requireAuthenticatedUser, throwDataError } from "./data.repository";
import { pageRange } from "./pagination";

type Row = Database["public"]["Tables"]["conversations"]["Row"];

function mapConversation(row: Row): Conversation {
    return {
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        archivedAt: row.archived_at,
    };
}

export const conversationsRepository = {
    async create(title: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase
            .from("conversations")
            .insert({ title: title.trim() })
            .select()
            .single();
        if (error) throwDataError(error, "We couldn't start that conversation.");
        return mapConversation(data);
    },

    async createWithMessage(conversationId: string | null, title: string, content: string, requestId: string, metadata: Json = {}) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.rpc("create_conversation_with_message", {
            target_conversation_id: conversationId,
            conversation_title: title.trim(),
            message_content: content.trim(),
            request_id: requestId,
            message_metadata: metadata,
        });
        if (error) throwDataError(error, "We couldn't save your message.");
        const result = data as { conversation_id?: string; message_id?: string; message_created_at?: string };
        if (!result.conversation_id || !result.message_id || !result.message_created_at) {
            throwDataError(null, "We couldn't confirm your saved message.");
        }
        return {
            conversationId: result.conversation_id,
            messageId: result.message_id,
            messageCreatedAt: result.message_created_at,
        };
    },

    async get(id: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase
            .from("conversations")
            .select()
            .eq("id", id)
            .maybeSingle();
        if (error) throwDataError(error);
        return data ? mapConversation(data) : null;
    },

    async list(options: PageOptions = {}, includeArchived = false, search?: string): Promise<Page<Conversation>> {
        await requireAuthenticatedUser();
        const { from, to, pageSize } = pageRange(options.page, options.pageSize);
        let query = supabase
            .from("conversations")
            .select()
            .order("updated_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to + 1);
        if (!includeArchived) query = query.is("archived_at", null);
        if (search?.trim()) query = query.ilike("title", `%${search.trim()}%`);
        const { data, error } = await query;
        if (error) throwDataError(error);
        return { items: data.slice(0, pageSize).map(mapConversation), hasMore: data.length > pageSize };
    },

    async update(id: string, values: { title?: string }) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase
            .from("conversations")
            .update(values.title === undefined ? {} : { title: values.title.trim() })
            .eq("id", id)
            .select()
            .single();
        if (error) throwDataError(error, "We couldn't update that conversation.");
        return mapConversation(data);
    },

    async archive(id: string) {
        await requireAuthenticatedUser();
        const { error } = await supabase
            .from("conversations")
            .update({ archived_at: new Date().toISOString() })
            .eq("id", id);
        if (error) throwDataError(error, "We couldn't archive that conversation.");
    },
};
