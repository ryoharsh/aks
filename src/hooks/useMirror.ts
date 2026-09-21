import { useCallback, useEffect, useRef, useState } from "react";

import { copy } from "@/constants/copy";
import { conversationsService } from "@/services/conversations.service";
import { createCheckInRequestId, mirrorService } from "@/services/mirror.service";
import type { Message } from "@/types/data";
import type { Json } from "@/types/database";
import type { PendingMirrorTurn } from "@/types/mirror";
import { mirrorOutboxService, type MirrorOutboxItem } from "@/services/mirrorOutbox.service";
import { MirrorRealtimeError, realTimeErrorMessage, type RealtimeEvent, type VoiceState } from "@/services/realtime/types";
import { ttsService } from "@/services/tts/tts.service";
import { useAuth } from "./useAuth";
import { useLanguage } from "@/providers/LanguageProvider";
import { mergeMessageLists, mergeTurnMessages, optimisticMessageId } from "./mirrorTurnMerge";

const isDev = typeof __DEV__ !== "undefined" && __DEV__;

export function useMirror(initialConversationId?: string) {
    const { user } = useAuth();
    // The language Aks answers in: whatever the user is reading the app in, so
    // a Hindi interface gets Hindi replies without a second setting to keep in
    // step. Read per turn rather than captured once, so a switch mid-session
    // applies to the next message.
    const { language } = useLanguage();
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
    const [pendingMessage, setPendingMessage] = useState<Message | null>(null);
    const voiceSession = useRef<ReturnType<typeof mirrorService.sendVoice> | null>(null);
    const [voiceActive, setVoiceActive] = useState(false);
    const [voiceState, setVoiceState] = useState<VoiceState>("idle");
    const [streamingUserTranscript, setStreamingUserTranscript] = useState("");
    const [streamingAssistantText, setStreamingAssistantText] = useState("");
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const [voiceErrorCode, setVoiceErrorCode] = useState<string | null>(null);
    const [streamingReplyText, setStreamingReplyText] = useState("");
    const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
    const [ttsSpeaking, setTtsSpeaking] = useState(false);
    const voiceOutputEnabledRef = useRef(false);
    const conversationIdRef = useRef<string | null>(null);

    useEffect(() => {
        conversationIdRef.current = conversationId;
    }, [conversationId]);

    useEffect(() => ttsService.subscribe((state) => setTtsSpeaking(state.speaking)), []);

    const toggleVoiceOutput = useCallback(() => {
        const next = !voiceOutputEnabledRef.current;
        voiceOutputEnabledRef.current = next;
        setVoiceOutputEnabled(next);
        if (!next) ttsService.stop();
        voiceSession.current?.setAssistantAudioEnabled?.(next);
    }, []);

    const streamReplyDelta = useCallback((turnId: string) => {
        return (text: string) => {
            setStreamingReplyText(text);
            if (voiceOutputEnabledRef.current) ttsService.updateTurn(turnId, text);
        };
    }, []);

    const finishTTSTurn = useCallback((turnId: string, text: string | undefined) => {
        if (!voiceOutputEnabledRef.current || !text?.trim()) return;
        ttsService.endTurn(turnId, text);
    }, []);

    const createRequestId = () => globalThis.crypto?.randomUUID?.()
        ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    /**
     * Pull the latest persisted messages (e.g. voice turns saved beside this
     * hook) into the visible list. Idempotent merge by id — optimistic rows,
     * regenerated replies, and history are never duplicated or reordered.
     */
    const refreshMessages = useCallback(async () => {
        const id = conversationIdRef.current;
        if (!id || loadingEarlierRef.current) return;
        try {
            const result = await conversationsService.listMessages(id, { page: 0, pageSize: 40 });
            messagePage.current = 0;
            setHasEarlier(result.hasMore);
            setMessages((current) => mergeMessageLists(current, [...result.items].reverse()));
        } catch {
            // Silent: the list stays as-is and the next turn refreshes again.
            // A refresh failure is never presented as a conversation error.
        }
    }, []);

    const applyVoiceEvent = (event: RealtimeEvent) => {
        switch (event.type) {
            case "sessionConnecting":
                setVoiceState("connecting");
                break;
            case "sessionReady":
                setVoiceState("connected");
                break;
            case "listening":
                setVoiceState("listening");
                break;
            case "userSpeechStarted":
                setVoiceState("userSpeaking");
                setStreamingAssistantText("");
                break;
            case "userTranscriptDelta":
                setStreamingUserTranscript(event.transcript);
                break;
            case "userTranscriptFinal":
                setStreamingUserTranscript(event.transcript);
                break;
            case "thinking":
                setVoiceState("thinking");
                break;
            case "assistantResponseStarted":
                setVoiceState("assistantSpeaking");
                break;
            case "assistantAudioStarted":
                setVoiceState("assistantSpeaking");
                break;
            case "assistantAudioFinished":
                setVoiceState((current) => current === "assistantSpeaking" ? "listening" : current);
                break;
            case "assistantTextDelta":
                setVoiceState("assistantSpeaking");
                setStreamingAssistantText(event.text);
                break;
            case "assistantTextFinal":
                setStreamingAssistantText(event.text);
                break;
            case "assistantInterrupted":
                setVoiceState("listening");
                break;
            case "reconnecting":
                setVoiceState("reconnecting");
                break;
            case "reconnected":
                setVoiceState("listening");
                break;
            case "error":
                setVoiceState("error");
                setVoiceError(event.message);
                setVoiceErrorCode(event.code);
                break;
            case "turnCompleted":
                setStreamingUserTranscript("");
                setStreamingAssistantText("");
                setVoiceState("listening");
                // Voice turns persist beside this hook (realtime service writes
                // through conversationsService), so pull them into the visible
                // list. Delayed slightly for the persistence chain to land;
                // the merge is idempotent. Skipped if the conversation changed
                // or the hook unmounted meanwhile.
                const scheduledRequest = request.current;
                void (async () => {
                    await new Promise((resolve) => setTimeout(resolve, 750));
                    if (scheduledRequest !== request.current) return;
                    await refreshMessages();
                })();
                break;
            case "sessionEnded":
                setVoiceActive(false);
                setVoiceState("ended");
                setStreamingUserTranscript("");
                setStreamingAssistantText("");
                break;
        }
    };

    const clearVoiceSession = () => {
        const session = voiceSession.current;
        voiceSession.current = null;
        session?.dispose();
    };

    const startVoiceConversation = async () => {
        if (voiceSession.current?.active) return;
        if (processingRef.current) return;
        if (!user) {
            setVoiceError(copy.errors.mirror.signInForVoice);
            setVoiceErrorCode(null);
            return;
        }
        ttsService.stop();
        setVoiceError(null);
        setVoiceErrorCode(null);
        setVoiceState("connecting");
        const session = mirrorService.sendVoice({
            conversationId,
            onEvent: applyVoiceEvent,
            onConversationIdChange: (id) => setConversationId(id),
        });
        session.setAssistantAudioEnabled?.(voiceOutputEnabledRef.current);
        voiceSession.current = session;
        setVoiceActive(true);
        try {
            await session.start();
        } catch (error) {
            if (isDev) console.error("[useMirror] startVoiceConversation failed:", error);
            voiceSession.current = null;
            setVoiceActive(false);
            setVoiceState("ended");
            setStreamingUserTranscript("");
            setStreamingAssistantText("");
            if (error instanceof MirrorRealtimeError) {
                setVoiceError(realTimeErrorMessage(error.code));
                setVoiceErrorCode(error.code);
            } else {
                setVoiceError(copy.errors.mirror.voiceStartFailed);
                setVoiceErrorCode(null);
            }
        }
    };

    const stopVoiceConversation = async () => {
        const session = voiceSession.current;
        if (!session) return;
        const wasActive = session.active;
        try {
            await session.stop();
        } catch {
            // The provider may already be gone.
        }
        if (wasActive) {
            try { session.dispose(); } catch { /* already disposed */ }
        }
        voiceSession.current = null;
        setVoiceActive(false);
        setVoiceState("ended");
        setStreamingUserTranscript("");
        setStreamingAssistantText("");
    };

    const interruptAssistant = () => {
        voiceSession.current?.interrupt();
    };

    const dismissVoiceError = () => {
        setVoiceError(null);
        setVoiceErrorCode(null);
    };

    useEffect(() => {
        setConversationId(initialConversationId ?? null);
        setMessages([]);
        setError(null);
        pending.current = null;
        pendingSave.current = null;
        pendingOutbox.current = null;
        setPendingMessage(null);
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
                        setPendingMessage(unanswered);
                        setError(copy.errors.mirror.noReply);
                    }
                }
            } catch {
                if (currentRequest === request.current) setError(copy.errors.conversationPlain);
            } finally {
                if (currentRequest === request.current) setLoading(false);
            }
        })();
        return () => { request.current += 1; };
    }, [initialConversationId]);

    useEffect(() => () => {
        request.current += 1;
        ttsService.stop();
    }, []);

    useEffect(() => () => { clearVoiceSession(); }, []);

    useEffect(() => {
        if (user) return;
        if (voiceSession.current?.active) void stopVoiceConversation();
        clearVoiceSession();
        ttsService.stop();
        voiceOutputEnabledRef.current = false;
        setVoiceOutputEnabled(false);
        setVoiceActive(false);
        setVoiceState("idle");
        setVoiceError(null);
        setVoiceErrorCode(null);
    }, [user, stopVoiceConversation, clearVoiceSession]);

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
            setError(copy.errors.mirror.unsavedRetry);
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

    const applyTurn = (turn: Awaited<ReturnType<typeof mirrorService.sendMessage>>, replaceId?: string | null) => {
        setConversationId(turn.conversationId);
        setMessages((current) => mergeTurnMessages(current, turn.userMessage, turn.assistantMessage, replaceId));
        const pendingTurn = turn.processingError?.retryable ? { conversationId: turn.conversationId, userMessage: turn.userMessage } : null;
        pending.current = pendingTurn;
        setPendingMessage(pendingTurn?.userMessage ?? null);
        setError(turn.processingError?.message ?? null);
        return turn;
    };

    const sendMessage = async (content: string, metadata: Json = {}) => {
        if (processingRef.current) throw new Error("A message is already processing.");
        if (voiceSession.current?.active) await stopVoiceConversation();
        ttsService.stop();
        if (pendingSave.current && pendingSave.current.content !== content.trim()) {
            setError(copy.errors.mirror.resolvePending);
            throw new Error("PENDING_MESSAGE_EXISTS");
        }
        processingRef.current = true;
        setProcessing(true);
        setError(null);
        setStreamingReplyText("");
        const ttsTurnId = createRequestId();
        let outboxPersisted: Promise<boolean> = Promise.resolve(false);
        let optimisticId: string | null = null;
        try {
            if (!user) throw new Error("MESSAGE_SAVE_FAILED");
            const normalized = content.trim();
            const currentRequest = request.current;
            const requestId = pendingSave.current?.content === normalized
                ? pendingSave.current.requestId
                : createRequestId();
            // Render the user's message instantly. The real saved message from
            // MirrorCore replaces this row on success; on failure it stays
            // visible next to the retry state below — never duplicated.
            optimisticId = optimisticMessageId(requestId);
            const optimistic: Message = {
                id: optimisticId,
                conversationId: conversationId ?? "pending",
                role: "user",
                content: normalized,
                replyToMessageId: null,
                metadata,
                createdAt: new Date().toISOString(),
            };
            setMessages((current) => mergeTurnMessages(current, optimistic, null));
            const outboxItem: MirrorOutboxItem = { requestId, conversationId, content: normalized, metadata, createdAt: new Date().toISOString() };
            pendingSave.current = outboxItem;
            // Queue on-device without blocking the network request: the Aks
            // request starts immediately below.
            outboxPersisted = mirrorOutboxService.set(user.id, outboxItem).then(() => true, () => false);
            pendingOutbox.current = outboxItem;
            setHasPendingOutbox(true);
            const result = await mirrorService.sendMessage(conversationId, normalized, requestId, metadata, streamReplyDelta(ttsTurnId), { language });
            if (currentRequest !== request.current) {
                ttsService.stop(ttsTurnId);
                // The conversation changed mid-flight: drop the optimistic row
                // so it never leaks into the other conversation.
                if (optimisticId) setMessages((current) => current.filter((message) => message.id !== optimisticId));
                return result;
            }
            const turn = applyTurn(result, optimisticId);
            finishTTSTurn(ttsTurnId, turn.assistantMessage?.content);
            setStreamingReplyText("");
            await mirrorOutboxService.clear(user.id).catch(() => undefined);
            pendingSave.current = null;
            pendingOutbox.current = null;
            setHasPendingOutbox(false);
            return turn;
        } catch {
            // Whether the message is safely queued on this device decides which
            // honest message the user sees. The optimistic message stays in the
            // list either way, next to the retry affordance.
            const queuedOnDevice = await outboxPersisted;
            pendingOutbox.current = queuedOnDevice ? pendingSave.current : null;
            setHasPendingOutbox(Boolean(pendingOutbox.current));
            setError(pendingOutbox.current
                ? copy.errors.mirror.outboxQueued
                : copy.errors.mirror.saveFailed);
            throw new Error("MESSAGE_SAVE_FAILED");
        } finally {
            processingRef.current = false;
            setProcessing(false);
        }
    };

    const retry = async () => {
        if (processingRef.current) return null;
        ttsService.stop();
        if (!pending.current && (pendingOutbox.current || pendingSave.current)) {
            const item = pendingOutbox.current ?? pendingSave.current!;
            return sendMessage(item.content, item.metadata);
        }
        if (!pending.current) return null;
        processingRef.current = true;
        setProcessing(true);
        setError(null);
        setStreamingReplyText("");
        const ttsTurnId = createRequestId();
        try {
            const result = await mirrorService.retryMessage(pending.current, streamReplyDelta(ttsTurnId), { language });
            const turn = applyTurn(result);
            finishTTSTurn(ttsTurnId, turn.assistantMessage?.content);
            setStreamingReplyText("");
            return turn;
        } finally {
            processingRef.current = false;
            setProcessing(false);
        }
    };

    /**
     * "Try again": re-answer the newest turn. The response is replaced only if
     * the server actually produced a new one, so a failed regeneration leaves the
     * previous response visible and reported as failed (9.7).
     */
    const regenerateReply = async () => {
        if (processingRef.current || loading) return null;
        const assistant = [...messages].reverse().find((message) => message.role === "assistant");
        const latest = messages[messages.length - 1];
        if (!assistant || !latest || latest.id !== assistant.id || !assistant.replyToMessageId) return null;
        const userMessage = messages.find((message) => message.id === assistant.replyToMessageId);
        if (!userMessage) return null;
        if (voiceSession.current?.active) await stopVoiceConversation();
        ttsService.stop();
        processingRef.current = true;
        setProcessing(true);
        setError(null);
        setStreamingReplyText("");
        const ttsTurnId = createRequestId();
        try {
            const result = await mirrorService.regenerateReply({ conversationId: assistant.conversationId, userMessage }, streamReplyDelta(ttsTurnId), { language });
            const turn = applyTurn(result);
            finishTTSTurn(ttsTurnId, turn.assistantMessage?.content);
            setStreamingReplyText("");
            return turn;
        } catch (error) {
            ttsService.stop(ttsTurnId);
            setError(copy.errors.mirror.refreshFailed);
            throw error;
        } finally {
            processingRef.current = false;
            setProcessing(false);
        }
    };

    /**
     * Correct the newest message that Aks has not answered yet, then generate the
     * response for the corrected turn. The stored message keeps its id, so the
     * turn is never duplicated and no reply is regenerated behind the user's
     * back (9.6).
     */
    const editPendingMessage = async (content: string) => {
        const target = pending.current;
        if (!target || processingRef.current) return null;
        const normalized = content.trim();
        if (!normalized) throw new Error("EMPTY_MESSAGE");
        processingRef.current = true;
        setProcessing(true);
        setError(null);
        try {
            const updated = normalized === target.userMessage.content
                ? target.userMessage
                : await conversationsService.editMessage(target.userMessage.id, normalized);
            setMessages((current) => current.map((message) => message.id === updated.id ? updated : message));
            pending.current = { conversationId: target.conversationId, userMessage: updated };
            setPendingMessage(updated);
        } catch {
            processingRef.current = false;
            setProcessing(false);
            setError(copy.errors.mirror.updateMessage);
            throw new Error("MESSAGE_EDIT_FAILED");
        }
        processingRef.current = false;
        setProcessing(false);
        return retry();
    };

    const pendingCheckInRequestIds = useRef<Record<string, string>>({});

    const sendCheckIn = async (mood: string) => {
        if (processingRef.current) throw new Error("A check-in is already processing.");
        processingRef.current = true;
        setProcessing(true);
        try {
            // A retried check-in reuses the same request id so the database can
            // replay the original instead of creating a duplicate.
            const requestId = pendingCheckInRequestIds.current[mood] ?? createCheckInRequestId();
            pendingCheckInRequestIds.current[mood] = requestId;
            const result = await mirrorService.sendCheckIn({ mood, metadata: { source: "mirror_quick_check_in" } }, requestId);
            delete pendingCheckInRequestIds.current[mood];
            return result;
        } catch {
            setError(copy.errors.mirror.checkInFailed);
            throw new Error("CHECK_IN_SAVE_FAILED");
        } finally {
            processingRef.current = false;
            setProcessing(false);
        }
    };

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
            setError(copy.errors.conversationEarlierPlain);
        } finally {
            loadingEarlierRef.current = false;
            setLoadingEarlier(false);
        }
    };

    const startNewConversation = () => {
        if (processingRef.current) return;
        if (pending.current || pendingOutbox.current || pendingSave.current) return;
        if (voiceSession.current?.active) void stopVoiceConversation();
        ttsService.stop();
        request.current += 1;
        setConversationId(null);
        setMessages([]);
        setHasEarlier(false);
        setError(null);
        setStreamingReplyText("");
        pending.current = null;
        setPendingMessage(null);
        pendingSave.current = null;
        if (user) void mirrorOutboxService.clear(user.id);
        pendingOutbox.current = null;
        setHasPendingOutbox(false);
    };

    const dismissError = () => setError(null);

    // "Try again" is only offered for the newest assistant response, and only
    // while nothing else is being generated.
    const latestMessage = messages.length ? messages[messages.length - 1] : null;
    const canRegenerate = Boolean(latestMessage && latestMessage.role === "assistant" && latestMessage.replyToMessageId) && !processing && !loading;

    return { conversationId, messages, loading, loadingEarlier, hasEarlier, processing, streamingReplyText, error, canRetry: Boolean(pending.current) || hasPendingOutbox || Boolean(pendingSave.current), sendMessage, retry, regenerateReply, canRegenerate, pendingMessage, editPendingMessage, sendCheckIn, loadEarlier, refreshMessages, startNewConversation, dismissError, voiceActive, voiceState, streamingUserTranscript, streamingAssistantText, voiceError, voiceErrorCode, startVoiceConversation, stopVoiceConversation, interruptAssistant, dismissVoiceError, voiceOutputEnabled, ttsSpeaking, toggleVoiceOutput };
}
