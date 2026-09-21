import { aiService } from "../ai/ai.service.ts";
import type { AIRequest, AIResult } from "../ai/types.ts";
import { isPolicyBlockedError } from "../ai/types.ts";
import { buildMirrorContext } from "./context.ts";
import type { MirrorDataRepository, StoredAssistant } from "./mirror.repository.ts";
import { conversationResponseTask, signalExtractionTask } from "./prompts.ts";
import { validateConversationResponse, validateSignals } from "./validation.ts";
import type { ValidatedSignal } from "./validation.ts";
import { requiresCrisisResponse } from "./safety.ts";
import { crisisResponseFor } from "./crisis-response.ts";
import type { MemoryRepository } from "../memory/memory.repository.ts";
import { evaluateMemory } from "../memory/memory.service.ts";
import type { PatternRepository } from "../pattern/pattern.repository.ts";
import { analyzePatterns } from "../pattern/pattern.service.ts";
import { resolveEarlyUnderstanding } from "../early-understanding/early-understanding.novelty.ts";

export type MirrorTurnInput = {
    repository: MirrorDataRepository;
    conversationId: string;
    userMessageId: string;
    ai?: { generate(request: AIRequest): Promise<AIResult> };
    memoryRepository?: MemoryRepository;
    patternRepository?: PatternRepository;
    /**
     * Regenerate the assistant reply of an already-answered turn. The user turn
     * is reused as-is and its single assistant message is replaced in place, so
     * a regeneration can never duplicate the user message or leave two visible
     * assistant versions behind (9.7).
     */
    regenerate?: boolean;
    /**
     * The language the client is currently displaying, when it supplied one.
     * Preferred over the stored preference: a language chosen while offline is
     * applied to the UI immediately but its server sync is best-effort, so the
     * request is the more current of the two signals.
     */
    responseLanguage?: string | null;
};

export type ConversationTurnResult = {
    conversationId: string;
    response: { response: { text: string }; followUp: string | null };
    assistantMessage: StoredAssistant;
    observable: boolean;
};

export type ObservationTurnResult = {
    signalsSaved: number;
    signals: ValidatedSignal[];
    memoryCandidates: Array<{ action: "created" | "updated"; memoryId: string; status: "candidate" | "active" | "rejected" | "archived" }>;
    patternActions: Array<{ action: "created" | "updated"; patternId: string; status: "candidate" | "possible" | "testing" | "supported" | "not_supported" | "archived" }>;
};

/**
 * ContextResolver relevance filter: which connected sources could be relevant
 * to this message. Topic-keyword based, deliberately coarse — the DB-side
 * window/bounding does the rest. null = no filter (all connected sources).
 * Exported so the streaming transport reuses the exact same relevance rules.
 */
export const relevantSourcesForMessage = (message: string): string[] | null => {
    const text = message.toLowerCase();
    const sources = new Set<string>();
    const has = (...patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text));
    if (has(/plan|schedule|meeting|calendar|event|busy|afternoon|morning|evening|today|tomorrow|noon|block/)) {
        sources.add("calendar"); sources.add("google_calendar"); sources.add("apple_calendar");
    }
    if (has(/task|todo|reminder|due|forgot|didn'?t do|unfinished/)) {
        sources.add("reminders"); sources.add("google_tasks"); sources.add("apple_reminders"); sources.add("todoist");
    }
    if (has(/where|out|home|office|travel|commut|away|location/)) {
        sources.add("location");
    }
    if (has(/work|commit|repo|code|pull request|github|project/)) {
        sources.add("github"); sources.add("notion");
    }
    if (has(/slack|message|email|inbox|notification|reply/)) {
        sources.add("slack"); sources.add("email");
    }
    if (has(/phone|screen|app|instagram|youtube|scroll|distract/)) {
        sources.add("screen_time"); sources.add("app_activity");
    }
    return sources.size ? [...sources] : null;
};

const makeRunAI = (input: MirrorTurnInput) => {
    const ai = input.ai ?? aiService;
    const claimRun = async (request: AIRequest) => input.regenerate && request.task === "conversation_response"
        ? input.repository.claimRegenerationRun({ conversationId: input.conversationId, userMessageId: input.userMessageId, task: request.task })
        : input.repository.claimAIRun({ conversationId: input.conversationId, userMessageId: input.userMessageId, task: request.task });
    return async <T>(request: AIRequest, validate: (content: string) => T) => {
        const claim = await claimRun(request);
        if (claim.status === "succeeded") return null;
        try {
            const result = await ai.generate(request);
            return { runId: claim.id, result, validated: validate(result.content) };
        } catch (error) {
            await input.repository.updateAIRun(claim.id, { status: "failed", error_code: error instanceof Error ? error.message.slice(0, 80) : "AI_FAILED", completed_at: new Date().toISOString() });
            if (isPolicyBlockedError(error)) {
                const tagged = new Error("CONTENT_POLICY_BLOCKED");
                (tagged as { policyBlocked?: boolean }).policyBlocked = true;
                throw tagged;
            }
            throw error;
        }
    };
};

/**
 * Persist the assistant reply for a turn. A regeneration replaces the existing
 * reply in place (one visible version, same message id, no duplicate rows); a
 * first generation keeps its idempotent insert-once behavior. Both paths re-read
 * the stored reply rather than failing when another request already wrote it.
 * Exported so the streaming transport persists replies with identical
 * semantics instead of maintaining a second, drifting copy of these rules.
 */
export async function persistAssistantReply(input: {
    repository: MirrorDataRepository;
    conversationId: string;
    userMessageId: string;
    regenerate: boolean;
    existing: StoredAssistant | null;
    content: string;
    responseText: string;
    followUp: string | null;
    taskVersion: string;
}): Promise<StoredAssistant> {
    if (input.regenerate && input.existing) {
        return input.repository.replaceAssistant({ messageId: input.existing.id, conversationId: input.conversationId, content: input.content, responseText: input.responseText, followUp: input.followUp, taskVersion: input.taskVersion });
    }
    try {
        return await input.repository.saveAssistant({ conversationId: input.conversationId, userMessageId: input.userMessageId, content: input.content, responseText: input.responseText, followUp: input.followUp, taskVersion: input.taskVersion });
    } catch {
        const stored = await input.repository.findAssistantReply(input.conversationId, input.userMessageId);
        if (!stored) throw new Error("ASSISTANT_PERSISTENCE_FAILED");
        return stored;
    }
}

const makeCompleteSuccessfulRun = (input: MirrorTurnInput) => (generated: { runId: string; result: AIResult }) => input.repository.updateAIRun(generated.runId, {
    status: "succeeded",
    provider: generated.result.provider,
    model: generated.result.model,
    latency_ms: generated.result.latencyMs,
    input_tokens: generated.result.usage?.inputTokens ?? null,
    output_tokens: generated.result.usage?.outputTokens ?? null,
    completed_at: new Date().toISOString(),
});

export async function processConversationTurn(input: MirrorTurnInput): Promise<ConversationTurnResult> {
    const runAI = makeRunAI(input);
    const completeSuccessfulRun = makeCompleteSuccessfulRun(input);
    const regenerate = input.regenerate === true;

    const conversation = await input.repository.getConversation(input.conversationId);
    const userMessage = await input.repository.getUserMessage(input.conversationId, input.userMessageId);
    if (userMessage.content.length > 12000) throw new Error("MESSAGE_TOO_LARGE");

    const persistAssistant = (values: { content: string; responseText: string; followUp: string | null; taskVersion: string }, existing: StoredAssistant | null) => persistAssistantReply({
        repository: input.repository,
        conversationId: input.conversationId,
        userMessageId: input.userMessageId,
        regenerate,
        existing,
        ...values,
    });

    const existingReply = await input.repository.findAssistantReply(input.conversationId, input.userMessageId);
    if (regenerate && !existingReply) throw new Error("NOTHING_TO_REGENERATE");
    if (existingReply && !regenerate) {
        await input.repository.reconcileAIRun(input.userMessageId, conversationResponseTask.task).catch(() => undefined);
        const safetyResponse = existingReply.metadata.task_version === "safety_response_v1";
        return {
            conversationId: input.conversationId,
            response: { response: { text: typeof existingReply.metadata.response_text === "string" ? existingReply.metadata.response_text : existingReply.content }, followUp: typeof existingReply.metadata.follow_up === "string" ? existingReply.metadata.follow_up : null },
            assistantMessage: existingReply,
            observable: !safetyResponse,
        };
    }

    const persistSafetyResponse = (text: string) => persistAssistant({ content: text, responseText: text, followUp: null, taskVersion: "safety_response_v1" }, existingReply)
        .catch(async () => {
            const stored = await input.repository.findAssistantReply(input.conversationId, input.userMessageId);
            if (!stored) throw new Error("ASSISTANT_PERSISTENCE_FAILED");
            return stored;
        });

    if (requiresCrisisResponse(userMessage.content)) {
        // This path short-circuits before the context load, so the language is
        // resolved here rather than reused from it. The client's own language
        // needs no query; only a client that omitted it falls back to the stored
        // preference — and a failed read must never delay or block the safety
        // response, so it degrades to English instead of throwing.
        const requested = input.responseLanguage ?? null;
        const stored = requested ? null : (await input.repository.getPreferences().catch(() => null))?.language ?? null;
        const crisisText = crisisResponseFor(requested ?? stored);
        const assistantMessage = await persistSafetyResponse(crisisText);
        return { conversationId: input.conversationId, response: { response: { text: crisisText }, followUp: null }, assistantMessage, observable: false };
    }

    const [recentMessages, recentSignals, activeMemories, supportedPatterns, activeExperiments, relevantLearnings, preferences, contextBundle] = await Promise.all([
        input.repository.getRecentMessages(input.conversationId, { createdAt: userMessage.createdAt, id: userMessage.id }),
        input.repository.getRecentSignals(userMessage.createdAt),
        input.memoryRepository?.getActiveMemories() ?? Promise.resolve([]),
        input.repository.getSupportedPatterns(),
        input.repository.getActiveExperiments(),
        input.repository.getRelevantLearnings(),
        input.repository.getPreferences(),
        input.repository.getContextBundle ? input.repository.getContextBundle(userMessage.createdAt, 6, 8, relevantSourcesForMessage(userMessage.content)) : Promise.resolve({ connectedSources: [] as string[], observations: [] as never[] }),
    ]);
    // The client's displayed language wins over the stored preference; neither
    // present resolves to English inside the context builder.
    const responseLanguage = input.responseLanguage ?? preferences.language ?? null;
    const context = buildMirrorContext({ currentMessage: userMessage.content, conversation: { title: conversation.title }, recentMessages, recentSignals, activeMemories, supportedPatterns, activeExperiments, relevantLearnings, preferences: { ...preferences, language: responseLanguage }, contextSources: contextBundle.connectedSources, relevantObservations: contextBundle.observations.slice(0, 8), earlyUnderstanding: (() => {
        // Early-understanding layer: signal-only, never raw text.
        // - pattern_ready/insufficient → null (handoff: formal supported/
        //   possible patterns already in context speak; Pattern Engine is the
        //   sole pattern gatekeeper with historical evidence).
        // - notice/emerging → text unless the same observation was already
        //   surfaced in recent assistant messages (novelty) or is covered by
        //   a formal pattern (continuity).
        try {
            const early = resolveEarlyUnderstanding({ signals: recentSignals, recentMessages, supportedPatterns });
            return early.noticeText ? { level: early.level, noticeText: early.noticeText } : null;
        } catch {
            return null;
        }
    })() });
    let policyBlocked = false;
    let responseRun;
    try {
        responseRun = await runAI({ ...conversationResponseTask, context }, validateConversationResponse);
    } catch (error) {
        if (!isPolicyBlockedError(error)) throw error;
        policyBlocked = true;
    }
    if (!responseRun) {
        if (!policyBlocked) throw new Error("AI_RUN_UNAVAILABLE");
        const crisisText = crisisResponseFor(responseLanguage);
        const assistantMessage = await persistSafetyResponse(crisisText);
        return { conversationId: input.conversationId, response: { response: { text: crisisText }, followUp: null }, assistantMessage, observable: false };
    }
    const validated = responseRun.validated;
    const imminent = validated.safety.risk === "imminent";
    const response = imminent
        ? { response: { text: crisisResponseFor(responseLanguage) }, followUp: null } as const
        : { response: validated.response, followUp: validated.followUp };
    const content = response.followUp ? `${response.response.text}\n\n${response.followUp}` : response.response.text;

    let assistantMessage: StoredAssistant;
    try {
        assistantMessage = await persistAssistant({ content, responseText: response.response.text, followUp: response.followUp, taskVersion: imminent ? "safety_response_v1" : conversationResponseTask.version }, existingReply);
    } catch {
        await input.repository.updateAIRun(responseRun.runId, { status: "failed", error_code: "ASSISTANT_PERSISTENCE_FAILED", completed_at: new Date().toISOString() });
        throw new Error("ASSISTANT_PERSISTENCE_FAILED");
    }
    await completeSuccessfulRun(responseRun);
    return { conversationId: input.conversationId, response, assistantMessage, observable: !imminent };
}

export async function processObservationPipeline(input: MirrorTurnInput): Promise<ObservationTurnResult> {
    const runAI = makeRunAI(input);
    const completeSuccessfulRun = makeCompleteSuccessfulRun(input);
    try {
        const userMessage = await input.repository.getUserMessage(input.conversationId, input.userMessageId);

        const extractSignals = async () => {
            try {
                const existing = await input.repository.getSignalsForMessage(input.userMessageId);
                if (existing.length) {
                    await input.repository.reconcileAIRun(input.userMessageId, signalExtractionTask.task).catch(() => undefined);
                    return existing;
                }
                const generated = await runAI({ ...signalExtractionTask, context: { currentMessage: userMessage.content } }, validateSignals);
                if (!generated) return [];
                if (generated.validated.length) {
                    const saved = await input.repository.saveSignals({ conversationId: input.conversationId, userMessageId: input.userMessageId, observedAt: userMessage.createdAt, signals: generated.validated });
                    await completeSuccessfulRun(generated);
                    return saved;
                }
                await completeSuccessfulRun(generated);
                return [];
            } catch {
                return [];
            }
        };

        const processMemory = async (signals: Array<{ signalType: string }>) => {
            if (!input.memoryRepository || !signals.length) return [];
            try {
                const result = await evaluateMemory({ repository: input.memoryRepository, ai: input.ai ?? aiService, conversationId: input.conversationId, userMessageId: input.userMessageId, observedAt: userMessage.createdAt, currentSignals: signals });
                return result.action === "no_action" ? [] : [result];
            } catch {
                return [];
            }
        };

        const processPatterns = async (signals: Array<{ signalType: string }>) => {
            if (!input.patternRepository || !signals.length) return [];
            try {
                return await analyzePatterns({ repository: input.patternRepository, ai: input.ai ?? aiService, conversationId: input.conversationId, userMessageId: input.userMessageId, observedAt: userMessage.createdAt, currentSignals: signals });
            } catch {
                return [];
            }
        };

        const signals = await extractSignals();
        const [memoryCandidates, patternActions] = await Promise.all([processMemory(signals), processPatterns(signals)]);
        return { signalsSaved: signals.length, signals, memoryCandidates, patternActions };
    } catch {
        return { signalsSaved: 0, signals: [], memoryCandidates: [], patternActions: [] };
    }
}

export async function processMirrorTurn(input: MirrorTurnInput): Promise<ConversationTurnResult & ObservationTurnResult> {
    const conversation = await processConversationTurn(input);
    // A regeneration re-answers an unchanged user turn: its observations were
    // already extracted, so re-running the pipeline would only re-read them.
    if (!conversation.observable || input.regenerate) {
        return { ...conversation, signalsSaved: 0, signals: [], memoryCandidates: [], patternActions: [] };
    }
    const observation = await processObservationPipeline(input);
    return { ...conversation, ...observation };
}