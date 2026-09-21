import { MirrorRepositoryError, mirrorRepository, type MirrorStreamResult } from "@/repositories/mirror.repository";
import { checkInsService } from "./checkIns.service";
import { conversationsService } from "./conversations.service";
import { createCheckInRequestId } from "@/repositories/checkIns.repository";
import type { Json } from "@/types/database";
import type { MirrorErrorCode, PendingMirrorTurn, MirrorTurn } from "@/types/mirror";
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
/**
 * Per-turn options. `language` is the language the app is currently displaying:
 * Aks answers in it, so a user reading the app in Hindi gets Hindi replies. The
 * server falls back to the account's stored preference when it is absent.
 */
export type MirrorTurnOptions = { language?: string };

async function generateReply(pending: PendingMirrorTurn, onDelta: ((accumulatedText: string) => void) | undefined, options: MirrorTurnOptions, regenerate = false): Promise<GeneratedReply> {
    if (onDelta) {
        try {
            const streamed = await mirrorRepository.processMessageStream(pending.conversationId, pending.userMessage.id, onDelta, { regenerate, language: options.language });
            return { ...streamed, signals: [], memoryCandidates: [], patternActions: [] };
        } catch {
            // Fall through to the non-streaming turn.
        }
    }
    return mirrorRepository.processMessage(pending.conversationId, pending.userMessage.id, { regenerate, language: options.language });
}

/**
 * Honest copy for a failed generation. A failed regeneration is never
 * presented as a success: the previous response is still visible, and the user
 * is told exactly that (9.7).
 */
function failureMessage(code: MirrorErrorCode, regenerate: boolean) {
    if (regenerate) {
        if (code === "RATE_LIMITED") return "Please wait a moment before trying again. The previous response is still here.";
        if (code === "ATTEMPTS_EXHAUSTED") return "Aks couldn't refresh this response after several attempts. The previous one is still here.";
        if (code === "NOTHING_TO_REGENERATE") return "That response can no longer be refreshed.";
        return "Aks couldn't refresh that response. The previous one is still here.";
    }
    if (code === "INVALID_AI_OUTPUT") return "Aks couldn't understand the response safely. Your message is saved.";
    if (code === "RATE_LIMITED") return "Please wait a moment before trying again. Your message is saved.";
    if (code === "ATTEMPTS_EXHAUSTED") return "Aks couldn't complete this response after several attempts. Your message is still saved.";
    if (code === "CONVERSATION_UNAVAILABLE") return "This conversation is no longer available. Your message may still be saved.";
    if (code === "NOTHING_TO_REGENERATE") return "That response can no longer be refreshed.";
    return "Aks couldn't process that right now. Your message is saved.";
}

async function processSavedMessage(pending: PendingMirrorTurn, onDelta: ((accumulatedText: string) => void) | undefined, options: MirrorTurnOptions, regenerate = false): Promise<MirrorTurn> {
    try {
        const generated = await generateReply(pending, onDelta, options, regenerate);
        dataEvents.emit("messages");
        dataEvents.emit("conversations");
        // A regeneration re-answers an unchanged user turn: its observations
        // already exist, so re-extracting them would only cost an AI call.
        if (!regenerate && generated.observable !== false) runObservation(pending.conversationId, pending.userMessage.id);
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
        return {
            ...pending,
            assistantMessage: null,
            result: null,
            processingError: {
                code,
                message: failureMessage(code, regenerate),
                retryable: code !== "CONVERSATION_UNAVAILABLE" && code !== "ATTEMPTS_EXHAUSTED" && code !== "NOTHING_TO_REGENERATE",
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
    async sendMessage(conversationId: string | null, content: string, requestId: string, metadata: Json = {}, onDelta?: (accumulatedText: string) => void, options: MirrorTurnOptions = {}) {
        const saved = await conversationsService.saveUserMessage(conversationId, content, requestId, metadata);
        return processSavedMessage({ conversationId: saved.conversationId, userMessage: saved.message }, onDelta, options);
    },
    retryMessage(pending: PendingMirrorTurn, onDelta?: (accumulatedText: string) => void, options: MirrorTurnOptions = {}) {
        return processSavedMessage(pending, onDelta, options);
    },
    /**
     * Re-answer an existing turn. The server replaces that turn's single
     * assistant message, so the user turn is never duplicated and only one
     * version is ever visible.
     */
    regenerateReply(pending: PendingMirrorTurn, onDelta?: (accumulatedText: string) => void, options: MirrorTurnOptions = {}) {
        return processSavedMessage(pending, onDelta, options, true);
    },
    sendCheckIn: checkInsService.createCheckIn,
    sendVoice(options: MirrorVoiceSessionOptions): MirrorVoiceSession {
        return mirrorRealtimeService.createSession(options);
    },
};
