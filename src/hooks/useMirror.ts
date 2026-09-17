import { useEffect, useRef, useState } from "react";

import { conversationsService } from "@/services/conversations.service";
import { mirrorService } from "@/services/mirror.service";
import type { Message } from "@/types/data";
import type { Json } from "@/types/database";
import type { PendingMirrorTurn } from "@/types/mirror";
import { mirrorOutboxService, type MirrorOutboxItem } from "@/services/mirrorOutbox.service";
import { useAuth } from "./useAuth";

export function useMirror(initialConversationId?: string) {
    const { user } = useAuth();
    const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(Boolean(initialConversationId));
    const [processing, setProcessing] = useState(false);
    const [loadingEarlier, setLoadingEarlier] = useState(false);
    const [hasEarlier, setHasEarlier] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pending = useRef<PendingMirrorTurn | null>(null);
    const request = useRef(0);
    const processingRef = useRef(false);
    const messagePage = useRef(0);
    const loadingEarlierRef = useRef(false);
    const pendingSave = useRef<MirrorOutboxItem | null>(null);
    const pendingOutbox = useRef<MirrorOutboxItem | null>(null);
    const [hasPendingOutbox, setHasPendingOutbox] = useState(false);

    const createRequestId = () => globalThis.crypto?.randomUUID?.()
        ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    useEffect(() => {
        setConversationId(initialConversationId ?? null);
        setMessages([]);
        setError(null);
        pending.current = null;
        pendingSave.current = null;
        pendingOutbox.current = null;
        setHasPendingOutbox(false);
        messagePage.current = 0;
        loadingEarlierRef.current = false;
        setLoadingEarlier(false);
        if (!initialConversationId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const currentRequest = ++request.current;
        void (async () => {
            try {
                const result = await conversationsService.listMessages(initialConversationId, { page: 0, pageSize: 40 });
                if (currentRequest === request.current) {
                    const chronological = [...result.items].reverse();
                    messagePage.current = 0;
                    setHasEarlier(result.hasMore);
                    setMessages(chronological);
                    const repliedTo = new Set(chronological.filter((message) => message.role === "assistant").map((message) => message.replyToMessageId));
                    const unanswered = [...chronological].reverse().find((message) => message.role === "user" && !repliedTo.has(message.id));
                    if (unanswered) {
                        pending.current = { conversationId: initialConversationId, userMessage: unanswered };
                        setError("Aks hasn't responded to your last message yet.");
                    }
                }
            } catch {
                if (currentRequest === request.current) setError("We couldn't load this conversation.");
            } finally {
                if (currentRequest === request.current) setLoading(false);
            }
        })();
        return () => { request.current += 1; };
    }, [initialConversationId]);

    useEffect(() => () => { request.current += 1; }, []);

    useEffect(() => {
        if (!user) return;
        let active = true;
        const userId = user.id;
        void mirrorOutboxService.get(userId).then((item) => {
            if (!active || !item) return;
            if (initialConversationId && item.conversationId !== initialConversationId) return;
            if (pendingSave.current) return;
            pendingOutbox.current = item;
            pendingSave.current = item;
            if (item.conversationId) setConversationId(item.conversationId);
            setHasPendingOutbox(true);
            setError("Your last message may not have finished saving. You can retry it safely.");
            if (item.conversationId && !initialConversationId) {
                void conversationsService.listMessages(item.conversationId, { page: 0, pageSize: 40 }).then((result) => {
                    if (!active) return;
                    messagePage.current = 0;
                    setHasEarlier(result.hasMore);
                    setMessages([...result.items].reverse());
                }).catch(() => undefined);
            }
        });
        return () => { active = false; };
    }, [initialConversationId, user]);

    const applyTurn = (turn: Awaited<ReturnType<typeof mirrorService.sendMessage>>) => {
        setConversationId(turn.conversationId);
        setMessages((current) => {
            const withUser = current.some((message) => message.id === turn.userMessage.id)
                ? current
                : [...current, turn.userMessage];
            return turn.assistantMessage && !withUser.some((message) => message.id === turn.assistantMessage?.id)
                ? [...withUser, turn.assistantMessage]
                : withUser;
        });
        pending.current = turn.processingError?.retryable ? { conversationId: turn.conversationId, userMessage: turn.userMessage } : null;
        setError(turn.processingError?.message ?? null);
        return turn;
    };

    const sendMessage = async (content: string, metadata: Json = {}) => {
        if (processingRef.current) throw new Error("A message is already processing.");
        if (pendingSave.current && pendingSave.current.content !== content.trim()) {
            setError("Retry or resolve your previous message before sending another one.");
            throw new Error("PENDING_MESSAGE_EXISTS");
        }
        processingRef.current = true;
        setProcessing(true);
        setError(null);
        try {
            if (!user) throw new Error("MESSAGE_SAVE_FAILED");
            const normalized = content.trim();
            const currentRequest = request.current;
            const requestId = pendingSave.current?.content === normalized
                ? pendingSave.current.requestId
                : createRequestId();
            const outboxItem: MirrorOutboxItem = { requestId, conversationId, content: normalized, metadata, createdAt: new Date().toISOString() };
            pendingSave.current = outboxItem;
            await mirrorOutboxService.set(user.id, outboxItem);
            pendingOutbox.current = outboxItem;
            setHasPendingOutbox(true);
            const result = await mirrorService.sendMessage(conversationId, normalized, requestId, metadata);
            if (currentRequest !== request.current) return result;
            const turn = applyTurn(result);
            await mirrorOutboxService.clear(user.id).catch(() => undefined);
            pendingSave.current = null;
            pendingOutbox.current = null;
            setHasPendingOutbox(false);
            return turn;
        } catch {
            setError("We couldn't save your message. Check your connection and try again.");
            throw new Error("MESSAGE_SAVE_FAILED");
        } finally {
            processingRef.current = false;
            setProcessing(false);
        }
    };

    const retry = async () => {
        if (processingRef.current) return null;
        if (!pending.current && (pendingOutbox.current || pendingSave.current)) {
            const item = pendingOutbox.current ?? pendingSave.current!;
            return sendMessage(item.content, item.metadata);
        }
        if (!pending.current) return null;
        processingRef.current = true;
        setProcessing(true);
        setError(null);
        try {
            return applyTurn(await mirrorService.retryMessage(pending.current));
        } finally {
            processingRef.current = false;
            setProcessing(false);
        }
    };

    const sendCheckIn = async (mood: string) => {
        if (processingRef.current) throw new Error("A check-in is already processing.");
        processingRef.current = true;
        setProcessing(true);
        try {
            return await mirrorService.sendCheckIn({ mood, metadata: { source: "mirror_quick_check_in" } });
        } catch {
            setError("We couldn't save your check-in. Please try again.");
            throw new Error("CHECK_IN_SAVE_FAILED");
        } finally {
            processingRef.current = false;
            setProcessing(false);
        }
    };

    const sendVoice = (audioUri: string) => mirrorService.sendVoice(audioUri);

    const loadEarlier = async () => {
        if (!conversationId || loadingEarlierRef.current || !hasEarlier) return;
        const currentRequest = request.current;
        const currentConversationId = conversationId;
        loadingEarlierRef.current = true;
        setLoadingEarlier(true);
        try {
            const nextPage = messagePage.current + 1;
            const result = await conversationsService.listMessages(currentConversationId, { page: nextPage, pageSize: 40 });
            if (currentRequest !== request.current || currentConversationId !== conversationId) return;
            messagePage.current = nextPage;
            setMessages((current) => {
                const known = new Set(current.map((message) => message.id));
                return [...result.items].reverse().filter((message) => !known.has(message.id)).concat(current);
            });
            setHasEarlier(result.hasMore);
        } catch {
            setError("We couldn't load earlier messages.");
        } finally {
            loadingEarlierRef.current = false;
            setLoadingEarlier(false);
        }
    };

    const startNewConversation = () => {
        if (processingRef.current) return;
        if (pending.current || pendingOutbox.current || pendingSave.current) return;
        request.current += 1;
        setConversationId(null);
        setMessages([]);
        setHasEarlier(false);
        setError(null);
        pending.current = null;
        pendingSave.current = null;
        if (user) void mirrorOutboxService.clear(user.id);
        pendingOutbox.current = null;
        setHasPendingOutbox(false);
    };

    const dismissError = () => setError(null);

    return { conversationId, messages, loading, loadingEarlier, hasEarlier, processing, error, canRetry: Boolean(pending.current) || hasPendingOutbox || Boolean(pendingSave.current), sendMessage, retry, sendCheckIn, sendVoice, loadEarlier, startNewConversation, dismissError };
}
