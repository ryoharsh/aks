import { conversationsService } from "@/services/conversations.service";

import type { RealtimeConversationSession, RealtimeEvent } from "./realtime/types";
import { realTimeErrorMessage } from "./realtime/types";
import { createRealtimeConversationSession } from "./realtime/RealtimeConversationService";
import { getRealtimeAudioHardware } from "./realtime/audio/realtime-audio";
import { getRealtimeProviderAdapter } from "./realtime/providers/supabase-realtime-adapter";

export type MirrorVoiceSessionOptions = {
    conversationId: string | null;
    onEvent?: (event: RealtimeEvent) => void;
    onConversationIdChange?: (conversationId: string) => void;
};

export type MirrorVoiceSession = RealtimeConversationSession & {
    readonly conversationId: () => string | null;
};

type SessionContext = {
    currentConversationId: string | null;
    onEvent?: (event: RealtimeEvent) => void;
    onConversationIdChange?: (conversationId: string) => void;
};

function createRequestId() {
    return globalThis.crypto?.randomUUID?.()
        ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createMirrorVoiceSession(options: MirrorVoiceSessionOptions): MirrorVoiceSession {
    const context: SessionContext = {
        currentConversationId: options.conversationId,
        onEvent: options.onEvent,
        onConversationIdChange: options.onConversationIdChange,
    };
    let persistenceChain: Promise<void> = Promise.resolve();
    let disposed = false;

    const surfacePersistenceError = (message: string) => {
        options.onEvent?.({
            type: "error",
            code: "REALTIME_PROVIDER_ERROR",
            message,
            retryable: true,
        });
    };

    const persistUserTranscript = (transcript: string) => {
        const normalized = transcript.trim();
        if (!normalized || disposed) return;
        persistenceChain = persistenceChain
            .then(async () => {
                if (disposed) return;
                const result = await conversationsService.saveUserMessage(
                    context.currentConversationId,
                    normalized,
                    createRequestId(),
                    { source: "voice_realtime" },
                );
                context.currentConversationId = result.conversationId;
                context.onConversationIdChange?.(result.conversationId);
            })
            .catch(() => surfacePersistenceError("We couldn’t save your voice message. It stays only in this session."));
    };

    const persistAssistantTranscript = (text: string) => {
        const normalized = text.trim();
        if (!normalized || disposed) return;
        const conversationId = context.currentConversationId;
        if (!conversationId) return;
        persistenceChain = persistenceChain
            .then(async () => {
                if (disposed) return;
                await conversationsService.createMessage(
                    conversationId,
                    "assistant",
                    normalized,
                    { source: "voice_realtime" },
                );
            })
            .catch(() => surfacePersistenceError("We couldn’t save Aks’s reply. It stays only in this session."));
    };

    const session = createRealtimeConversationSession({
        getConversationId: () => context.currentConversationId,
        adapter: getRealtimeProviderAdapter(),
        getAudio: getRealtimeAudioHardware,
        onEvent: (event) => {
            context.onEvent?.(event);
            if (event.type === "userTranscriptFinal") persistUserTranscript(event.transcript);
            if (event.type === "assistantTextFinal") persistAssistantTranscript(event.text);
        },
    });

    return {
        ...session,
        conversationId: () => context.currentConversationId,
        async stop() {
            await session.stop();
            // Persistence that is still queued must finish so no voice
            // turn is dropped from the transcript.
            await persistenceChain;
        },
        async start() {
            if (disposed) throw new Error("This voice session is disposed.");
            await session.start();
        },
        dispose() {
            disposed = true;
            session.dispose();
        },
    };
}

export const mirrorRealtimeService = {
    createSession(options: MirrorVoiceSessionOptions): MirrorVoiceSession {
        return createMirrorVoiceSession(options);
    },
};

export type { VoiceState, RealtimeEvent } from "./realtime/types";
export { realTimeErrorMessage, isMirrorRealtimeError, MirrorRealtimeError } from "./realtime/types";