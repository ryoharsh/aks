import { conversationsRepository } from "@/repositories/conversations.repository";
import { messagesRepository } from "@/repositories/messages.repository";
import type { Json } from "@/types/database";
import type { MessageRole, PageOptions } from "@/types/data";
import { copy } from "@/constants/copy";
import { dataEvents } from "./dataEvents";

function titleFromMessage(content: string) {
    const firstLine = content.trim().split(/\r?\n/, 1)[0];
    return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
}

export const conversationsService = {
    createConversation: async (title: string) => {
        const conversation = await conversationsRepository.create(title);
        dataEvents.emit("conversations");
        return conversation;
    },
    getConversation: conversationsRepository.get,
    listConversations: conversationsRepository.list,
    updateConversation: async (...args: Parameters<typeof conversationsRepository.update>) => {
        const conversation = await conversationsRepository.update(...args);
        dataEvents.emit("conversations");
        return conversation;
    },
    archiveConversation: async (id: string) => {
        await conversationsRepository.archive(id);
        dataEvents.emit("conversations");
        dataEvents.emit("conversationArchived");
    },
    getMessage: messagesRepository.get,
    listMessages: messagesRepository.list,
    createMessage: async (conversationId: string, role: MessageRole, content: string, metadata?: Json) => {
        const message = await messagesRepository.create(conversationId, role, content, metadata);
        dataEvents.emit("messages");
        dataEvents.emit("conversations");
        return message;
    },
    editMessage: async (messageId: string, content: string) => {
        const message = await conversationsRepository.editMessage(messageId, content);
        dataEvents.emit("messages");
        return message;
    },
    async saveUserMessage(conversationId: string | null, content: string, requestId: string, metadata: Json = {}) {
        const normalized = content.trim();
        if (!normalized) throw new Error(copy.errors.emptyMessage);
        const created = await conversationsRepository.createWithMessage(
            conversationId,
            titleFromMessage(normalized),
            normalized,
            requestId,
            metadata,
        );
        const result = {
            conversationId: created.conversationId,
            message: {
                id: created.messageId,
                conversationId: created.conversationId,
                role: "user" as const,
                content: normalized,
                replyToMessageId: null,
                metadata,
                createdAt: created.messageCreatedAt,
            },
        };
        dataEvents.emit("messages");
        dataEvents.emit("conversations");
        return result;
    },
};

export type { PageOptions };
