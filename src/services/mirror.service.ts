import { MirrorRepositoryError, mirrorRepository } from "@/repositories/mirror.repository";
import { checkInsService } from "./checkIns.service";
import { conversationsService } from "./conversations.service";
import type { Json } from "@/types/database";
import type { PendingMirrorTurn, MirrorTurn } from "@/types/mirror";
import { dataEvents } from "./dataEvents";
import { mirrorRealtimeService, type MirrorVoiceSession, type MirrorVoiceSessionOptions } from "./mirror-realtime.service";

async function processSavedMessage(pending: PendingMirrorTurn): Promise<MirrorTurn> {
    try {
        const generated = await mirrorRepository.processMessage(pending.conversationId, pending.userMessage.id);
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
    async sendMessage(conversationId: string | null, content: string, requestId: string, metadata: Json = {}) {
        const saved = await conversationsService.saveUserMessage(conversationId, content, requestId, metadata);
        return processSavedMessage({ conversationId: saved.conversationId, userMessage: saved.message });
    },
    retryMessage: processSavedMessage,
    sendCheckIn: checkInsService.createCheckIn,
    sendVoice(options: MirrorVoiceSessionOptions): MirrorVoiceSession {
        return mirrorRealtimeService.createSession(options);
    },
};
