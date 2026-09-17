import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/types/database";
import type { Message, MessageRole, Page, PageOptions } from "@/types/data";
import { requireAuthenticatedUser, throwDataError } from "./data.repository";
import { pageRange } from "./pagination";

type Row = Database["public"]["Tables"]["messages"]["Row"];

function mapMessage(row: Row): Message {
    return {
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role,
        content: row.content,
        replyToMessageId: row.reply_to_message_id,
        metadata: row.metadata,
        createdAt: row.created_at,
    };
}

export const messagesRepository = {
    async create(conversationId: string, role: MessageRole, content: string, metadata: Json = {}) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase
            .from("messages")
            .insert({ conversation_id: conversationId, role, content: content.trim(), metadata })
            .select()
            .single();
        if (error) throwDataError(error, "We couldn't save that message.");
        return mapMessage(data);
    },

    async get(id: string) {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.from("messages").select().eq("id", id).maybeSingle();
        if (error) throwDataError(error);
        return data ? mapMessage(data) : null;
    },

    async list(conversationId: string, options: PageOptions = {}): Promise<Page<Message>> {
        await requireAuthenticatedUser();
        const { from, to, pageSize } = pageRange(options.page, options.pageSize);
        const { data, error } = await supabase
            .from("messages")
            .select()
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to + 1);
        if (error) throwDataError(error);
        return { items: data.slice(0, pageSize).map(mapMessage), hasMore: data.length > pageSize };
    },
};
