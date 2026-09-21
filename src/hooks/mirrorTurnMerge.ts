import type { Message } from "@/types/data";

/** Request-scoped id for the instantly-rendered message. A retry reuses the
 * request id, so it replaces the same row instead of duplicating it. */
export function optimisticMessageId(requestId: string) {
    return `pending-${requestId}`;
}

/**
 * Pure turn merge: drops the optimistic row (if any), then joins real
 * messages by id so a regenerated reply replaces instead of stacking.
 */
export function mergeTurnMessages(
    current: Message[],
    userMessage: Message | null,
    assistantMessage: Message | null,
    replaceId?: string | null,
): Message[] {
    const merge = (existing: Message[], incoming: Message | null) => {
        if (!incoming) return existing;
        const index = existing.findIndex((message) => message.id === incoming.id);
        if (index === -1) return [...existing, incoming];
        if (existing[index] === incoming) return existing;
        const next = [...existing];
        next[index] = incoming;
        return next;
    };
    const withoutOptimistic = replaceId ? current.filter((message) => message.id !== replaceId) : current;
    return merge(merge(withoutOptimistic, userMessage), assistantMessage);
}

/**
 * Pure chronological merge for list refreshes (e.g. voice turns persisted
 * beside the hook). Joins by id — history, optimistic rows, and regenerated
 * replies are never duplicated — then orders oldest first.
 */
export function mergeMessageLists(current: Message[], incoming: Message[]): Message[] {
    const known = new Map(current.map((message) => [message.id, message]));
    for (const item of incoming) known.set(item.id, item);
    return [...known.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
