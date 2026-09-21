import { useCallback, useEffect, useRef, useState } from "react";

import { copy } from "@/constants/copy";
import { usePagedData } from "./usePagedData";
import { conversationsService } from "@/services/conversations.service";
import type { Conversation, Message } from "@/types/data";
import { dataEvents } from "@/services/dataEvents";

export function useConversations(query = "") {
    const loadConversations = useCallback(
        (options: Parameters<typeof conversationsService.listConversations>[0]) =>
            conversationsService.listConversations(options, false, query),
        [query],
    );
    const page = usePagedData(loadConversations);
    useEffect(() => dataEvents.subscribe("conversations", () => { void page.refresh(); }), [page.refresh]);

    const archive = async (id: string) => {
        await conversationsService.archiveConversation(id);
        await page.refresh();
    };

    return { ...page, conversations: page.items, archive };
}

export function useConversation(conversationId: string) {
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
    const page = useRef(0);
    const requestRef = useRef(0);
    const loadingMoreRef = useRef(false);
    const loadMoreRequestRef = useRef(0);

    const refresh = useCallback(async () => {
        const request = ++requestRef.current;
        loadMoreRequestRef.current += 1;
        loadingMoreRef.current = false;
        setLoadingMore(false);
        setLoading(true);
        setError(null);
        setLoadMoreError(null);
        try {
            const [nextConversation, messagePage] = await Promise.all([
                conversationsService.getConversation(conversationId),
                conversationsService.listMessages(conversationId, { page: 0, pageSize: 40 }),
            ]);
            if (request !== requestRef.current) return;
            page.current = 0;
            setConversation(nextConversation);
            setMessages([...messagePage.items].reverse());
            setHasMore(messagePage.hasMore);
        } catch {
            if (request === requestRef.current) setError(copy.errors.conversation);
        } finally {
            if (request === requestRef.current) setLoading(false);
        }
    }, [conversationId]);

    const loadMore = async () => {
        if (loadingMoreRef.current || !hasMore) return;
        const request = requestRef.current;
        const loadMoreRequest = ++loadMoreRequestRef.current;
        loadingMoreRef.current = true;
        setLoadingMore(true);
        setLoadMoreError(null);
        try {
            const nextPage = page.current + 1;
            const result = await conversationsService.listMessages(conversationId, { page: nextPage, pageSize: 40 });
            if (request !== requestRef.current) return;
            page.current = nextPage;
            setMessages((current) => [[...result.items].reverse(), current].flat());
            setHasMore(result.hasMore);
        } catch {
            if (request === requestRef.current) setLoadMoreError("We couldn't load earlier messages. Please try again.");
        } finally {
            if (loadMoreRequest === loadMoreRequestRef.current) {
                loadingMoreRef.current = false;
                setLoadingMore(false);
            }
        }
    };

    const [renameError, setRenameError] = useState<string | null>(null);
    const rename = async (title: string) => {
        const normalized = title.trim();
        if (!normalized) return null;
        try {
            const updated = await conversationsService.updateConversation(conversationId, { title: normalized });
            setConversation(updated);
            setRenameError(null);
            return updated;
        } catch {
            setRenameError("We couldn't rename that conversation. Please try again.");
            return null;
        }
    };

    useEffect(() => {
        void refresh();
        return () => { requestRef.current += 1; };
    }, [refresh]);
    useEffect(() => dataEvents.subscribe("messages", () => { void refresh(); }), [refresh]);
    return { conversation, messages, loading, loadingMore, hasMore, error, loadMoreError, refresh, loadMore, rename, renameError };
}
