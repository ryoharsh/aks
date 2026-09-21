import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/types/database";
import type { Conversation, Page, PageOptions } from "@/types/data";
import { copy } from "@/constants/copy";
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
        if (error) throwDataError(error, copy.errors.writes.startConversation);
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
        if (error) throwDataError(error, copy.errors.writes.sendMessage);
        const result = data as { conversation_id?: string; message_id?: string; message_created_at?: string };
        if (!result.conversation_id || !result.message_id || !result.message_created_at) {
            throwDataError(null, copy.errors.writes.confirmMessage);
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
        const searchQuery = search?.trim();

        // Search covers the title AND message content, server-side and paginated,
        // so a conversation can be found by what was actually said in it.
        if (searchQuery && !includeArchived) {
            const { data, error } = await supabase.rpc("search_conversations", {
                search_query: searchQuery,
                page_offset: from,
                page_size: pageSize,
            });
            if (error) throwDataError(error, copy.errors.writes.searchConversations);
            const result = data as { items?: Row[]; has_more?: boolean } | null;
            return { items: (result?.items ?? []).map(mapConversation), hasMore: Boolean(result?.has_more) };
        }

        let query = supabase
            .from("conversations")
            .select()
            .order("updated_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to + 1);
        if (!includeArchived) query = query.is("archived_at", null);
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
        if (error) throwDataError(error, copy.errors.writes.updateConversation);
        return mapConversation(data);
    },

    /**
     * Correct a message that Aks has not answered yet. The server decides
     * whether that is still allowed (no reply, no derived observations, newest
     * turn only), so the client cannot silently rewrite history.
     */
    async editMessage(messageId: string, content: string) {
        await requireAuthenticatedUser();
        const normalized = content.trim();
        if (!normalized) throwDataError(null, copy.errors.messageEmptySave);
        const { data, error } = await supabase.rpc("edit_user_message", {
            target_message_id: messageId,
            new_content: normalized,
        });
        if (error) throwDataError(error, copy.errors.writes.updateMessage);
        const result = data as { id?: string; conversation_id?: string; content?: string; created_at?: string; metadata?: Json } | null;
        if (!result?.id || !result.conversation_id || typeof result.content !== "string" || !result.created_at) {
            throwDataError(null, copy.errors.writes.confirmUpdatedMessage);
        }
        return {
            id: result.id,
            conversationId: result.conversation_id,
            role: "user" as const,
            content: result.content,
            replyToMessageId: null,
            metadata: result.metadata ?? {},
            createdAt: result.created_at,
        };
    },

    async archive(id: string) {
        await requireAuthenticatedUser();
        const { error } = await supabase
            .from("conversations")
            .update({ archived_at: new Date().toISOString() })
            .eq("id", id);
        if (error) throwDataError(error, copy.errors.writes.archiveConversation);
    },
};
