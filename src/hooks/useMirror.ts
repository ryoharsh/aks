import { useCallback, useEffect, useRef, useState } from "react";

import { conversationsService } from "@/services/conversations.service";
import { createCheckInRequestId, mirrorService } from "@/services/mirror.service";
import type { Message } from "@/types/data";
import type { Json } from "@/types/database";
import type { PendingMirrorTurn } from "@/types/mirror";
import { mirrorOutboxService, type MirrorOutboxItem } from "@/services/mirrorOutbox.service";
import { MirrorRealtimeError, realTimeErrorMessage, type RealtimeEvent, type VoiceState } from "@/services/realtime/types";
import { ttsService } from "@/services/tts/tts.service";
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
    const voiceSession = useRef<ReturnType<typeof mirrorService.sendVoice> | null>(null);
    const [voiceActive, setVoiceActive] = useState(false);
    const [voiceState, setVoiceState] = useState<VoiceState>("idle");
    const [streamingUserTranscript, setStreamingUserTranscript] = useState("");
    const [streamingAssistantText, setStreamingAssistantText] = useState("");
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const [streamingReplyText, setStreamingReplyText] = useState("");
    const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
    const [ttsSpeaking, setTtsSpeaking] = useState(false);
    const voiceOutputEnabledRef = useRef(false);

    useEffect(() => ttsService.subscribe((state) => setTtsSpeaking(state.speaking)), []);

    const toggleVoiceOutput = useCallback(() => {
        setVoiceOutputEnabled((enabled) => {
            const next = !enabled;
            voiceOutputEnabledRef.current = next;
            if (!next) ttsService.stop();
            return next;
        });
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
                break;
            case "turnCompleted":
                setStreamingUserTranscript("");
                setStreamingAssistantText("");
                setVoiceState("listening");
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
            setVoiceError("Voice conversations are available after you sign in.");
            return;
        }
        ttsService.stop();
        setVoiceError(null);
        setVoiceState("connecting");
        const session = mirrorService.sendVoice({
            conversationId,
            onEvent: applyVoiceEvent,
            onConversationIdChange: (id) => setConversationId(id),
        });
        voiceSession.current = session;
        setVoiceActive(true);
        try {
            await session.start();
        } catch (error) {
            voiceSession.current = null;
            setVoiceActive(false);
            setVoiceState("ended");
            setStreamingUserTranscript("");
            setStreamingAssistantText("");
            setVoiceError(error instanceof MirrorRealtimeError ? realTimeErrorMessage(error.code) : "We couldn’t start a voice conversation.");
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

    const dismissVoiceError = () => setVoiceError(null);

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
        if (voiceSession.current?.active) await stopVoiceConversation();
        ttsService.stop();
        if (pendingSave.current && pendingSave.current.content !== content.trim()) {
            setError("Retry or resolve your previous message before sending another one.");
            throw new Error("PENDING_MESSAGE_EXISTS");
        }
        processingRef.current = true;
        setProcessing(true);
        setError(null);
        setStreamingReplyText("");
        const ttsTurnId = createRequestId();
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
            const result = await mirrorService.sendMessage(conversationId, normalized, requestId, metadata, streamReplyDelta(ttsTurnId));
            if (currentRequest !== request.current) {
                ttsService.stop(ttsTurnId);
                return result;
            }
            const turn = applyTurn(result);
            finishTTSTurn(ttsTurnId, turn.assistantMessage?.content);
            setStreamingReplyText("");
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
            const result = await mirrorService.retryMessage(pending.current, streamReplyDelta(ttsTurnId));
            const turn = applyTurn(result);
            finishTTSTurn(ttsTurnId, turn.assistantMessage?.content);
            setStreamingReplyText("");
            return turn;
        } finally {
            processingRef.current = false;
            setProcessing(false);
        }
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
            setError("We couldn't save your check-in. Please try again.");
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
            setError("We couldn't load earlier messages.");
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
        pendingSave.current = null;
        if (user) void mirrorOutboxService.clear(user.id);
        pendingOutbox.current = null;
        setHasPendingOutbox(false);
    };

    const dismissError = () => setError(null);

    return { conversationId, messages, loading, loadingEarlier, hasEarlier, processing, streamingReplyText, error, canRetry: Boolean(pending.current) || hasPendingOutbox || Boolean(pendingSave.current), sendMessage, retry, sendCheckIn, loadEarlier, startNewConversation, dismissError, voiceActive, voiceState, streamingUserTranscript, streamingAssistantText, voiceError, startVoiceConversation, stopVoiceConversation, interruptAssistant, dismissVoiceError, voiceOutputEnabled, ttsSpeaking, toggleVoiceOutput };
}
