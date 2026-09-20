import { MirrorRepositoryError, mirrorRepository, type MirrorStreamResult } from "@/repositories/mirror.repository";
import { checkInsService } from "./checkIns.service";
import { conversationsService } from "./conversations.service";
import { createCheckInRequestId } from "@/repositories/checkIns.repository";
import type { Json } from "@/types/database";
import type { PendingMirrorTurn, MirrorTurn } from "@/types/mirror";
import { dataEvents } from "./dataEvents";
import { mirrorRealtimeService, type MirrorVoiceSession, type MirrorVoiceSessionOptions } from "./mirror-realtime.service";

export { createCheckInRequestId };

type GeneratedReply = {
    assistantMessage: MirrorStreamResult["assistantMessage"];
    response: MirrorStreamResult["response"];
    observable: boolean;
    signals: Array<{ signalType: string; value: Record<string, unknown>; confidence: number | null }>;
    memoryCandidates: Array<{ action: "created" | "updated"; memoryId: string; status: "candidate" | "active" | "rejected" | "archived" }>;
    patternActions: Array<{ action: "created" | "updated"; patternId: string; status: "candidate" | "possible" | "testing" | "supported" | "not_supported" | "archived" }>;
};

/**
 * Generate the assistant reply. Streams through mirror-stream when a delta
 * handler is present so the UI can show text as it arrives; any stream
 * failure falls back to the non-streaming turn (same claim/persistence
 * semantics server-side).
 */
async function generateReply(pending: PendingMirrorTurn, onDelta?: (accumulatedText: string) => void): Promise<GeneratedReply> {
    if (onDelta) {
        try {
            const streamed = await mirrorRepository.processMessageStream(pending.conversationId, pending.userMessage.id, onDelta);
            return { ...streamed, signals: [], memoryCandidates: [], patternActions: [] };
        } catch {
            // Fall through to the non-streaming turn.
        }
    }
    return mirrorRepository.processMessage(pending.conversationId, pending.userMessage.id);
}

async function processSavedMessage(pending: PendingMirrorTurn, onDelta?: (accumulatedText: string) => void): Promise<MirrorTurn> {
    try {
        const generated = await generateReply(pending, onDelta);
        dataEvents.emit("messages");
        dataEvents.emit("conversations");
        if (generated.observable !== false) runObservation(pending.conversationId, pending.userMessage.id);
        const memoryCandidates = generated.memoryCandidates ?? [];
        const patternActions = generated.patternActions ?? [];
        return {
            ...pending,
            assistantMessage: generated.assistantMessage,
            result: {
                response: generated.response.response,
                followUp: generated.response.followUp,
                signals: generated.signals,
                memoryCandidates,
                patternActions,
            },
            processingError: null,
        };
    } catch (error) {
        const code = error instanceof MirrorRepositoryError ? error.code : "AI_UNAVAILABLE";
        const message = code === "INVALID_AI_OUTPUT"
            ? "Aks couldn't understand the response safely. Your message is saved."
            : code === "RATE_LIMITED"
                ? "Please wait a moment before trying again. Your message is saved."
                : code === "ATTEMPTS_EXHAUSTED"
                    ? "Aks couldn't complete this response after several attempts. Your message is still saved."
                : code === "CONVERSATION_UNAVAILABLE"
                    ? "This conversation is no longer available. Your message may still be saved."
                    : "Aks couldn't process that right now. Your message is saved.";
        return {
            ...pending,
            assistantMessage: null,
            result: null,
            processingError: {
                code,
                message,
                retryable: code !== "CONVERSATION_UNAVAILABLE" && code !== "ATTEMPTS_EXHAUSTED",
            },
        };
    }
}

function runObservation(conversationId: string, userMessageId: string) {
    void mirrorRepository.processObservations(conversationId, userMessageId)
        .then((observed) => {
            if (observed.signalsSaved > 0) dataEvents.emit("signals");
            if ((observed.memoryCandidates ?? []).length) dataEvents.emit("memories");
            if ((observed.patternActions ?? []).length) dataEvents.emit("patterns");
        })
        .catch(() => undefined);
}

export const mirrorService = {
    async sendMessage(conversationId: string | null, content: string, requestId: string, metadata: Json = {}, onDelta?: (accumulatedText: string) => void) {
        const saved = await conversationsService.saveUserMessage(conversationId, content, requestId, metadata);
        return processSavedMessage({ conversationId: saved.conversationId, userMessage: saved.message }, onDelta);
    },
    retryMessage(pending: PendingMirrorTurn, onDelta?: (accumulatedText: string) => void) {
        return processSavedMessage(pending, onDelta);
    },
    sendCheckIn: checkInsService.createCheckIn,
    sendVoice(options: MirrorVoiceSessionOptions): MirrorVoiceSession {
        return mirrorRealtimeService.createSession(options);
    },
};
