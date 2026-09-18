import { aiService } from "../ai/ai.service.ts";
import type { AIRequest, AIResult } from "../ai/types.ts";
import { isPolicyBlockedError } from "../ai/types.ts";
import { buildMirrorContext } from "./context.ts";
import type { MirrorDataRepository, StoredAssistant } from "./mirror.repository.ts";
import { conversationResponseTask, signalExtractionTask } from "./prompts.ts";
import { validateConversationResponse, validateSignals } from "./validation.ts";
import type { ValidatedSignal } from "./validation.ts";
import { crisisResponse, requiresCrisisResponse } from "./safety.ts";
import type { MemoryRepository } from "../memory/memory.repository.ts";
import { evaluateMemory } from "../memory/memory.service.ts";
import type { PatternRepository } from "../pattern/pattern.repository.ts";
import { analyzePatterns } from "../pattern/pattern.service.ts";

export type MirrorTurnInput = {
    repository: MirrorDataRepository;
    conversationId: string;
    userMessageId: string;
    ai?: { generate(request: AIRequest): Promise<AIResult> };
    memoryRepository?: MemoryRepository;
    patternRepository?: PatternRepository;
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

const makeRunAI = (input: MirrorTurnInput) => {
    const ai = input.ai ?? aiService;
    return async <T>(request: AIRequest, validate: (content: string) => T) => {
        const claim = await input.repository.claimAIRun({ conversationId: input.conversationId, userMessageId: input.userMessageId, task: request.task });
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

    const conversation = await input.repository.getConversation(input.conversationId);
    const userMessage = await input.repository.getUserMessage(input.conversationId, input.userMessageId);
    if (userMessage.content.length > 12000) throw new Error("MESSAGE_TOO_LARGE");

    const persistSafetyResponse = async () => {
        try {
            return await input.repository.saveAssistant({ conversationId: input.conversationId, userMessageId: input.userMessageId, content: crisisResponse, responseText: crisisResponse, followUp: null, taskVersion: "safety_response_v1" });
        } catch {
            const existing = await input.repository.findAssistantReply(input.conversationId, input.userMessageId);
            if (!existing) throw new Error("ASSISTANT_PERSISTENCE_FAILED");
            return existing;
        }
    };

    const existingReply = await input.repository.findAssistantReply(input.conversationId, input.userMessageId);
    if (existingReply) {
        await input.repository.reconcileAIRun(input.userMessageId, conversationResponseTask.task).catch(() => undefined);
        const safetyResponse = existingReply.metadata.task_version === "safety_response_v1";
        return {
            conversationId: input.conversationId,
            response: { response: { text: typeof existingReply.metadata.response_text === "string" ? existingReply.metadata.response_text : existingReply.content }, followUp: typeof existingReply.metadata.follow_up === "string" ? existingReply.metadata.follow_up : null },
            assistantMessage: existingReply,
            observable: !safetyResponse,
        };
    }

    if (requiresCrisisResponse(userMessage.content)) {
        const assistantMessage = await persistSafetyResponse();
        return { conversationId: input.conversationId, response: { response: { text: crisisResponse }, followUp: null }, assistantMessage, observable: false };
    }

    const [recentMessages, recentSignals, activeMemories, preferences] = await Promise.all([
        input.repository.getRecentMessages(input.conversationId, { createdAt: userMessage.createdAt, id: userMessage.id }),
        input.repository.getRecentSignals(userMessage.createdAt),
        input.memoryRepository?.getActiveMemories() ?? Promise.resolve([]),
        input.repository.getPreferences(),
    ]);
    const context = buildMirrorContext({ currentMessage: userMessage.content, conversation: { title: conversation.title }, recentMessages, recentSignals, activeMemories, preferences });
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
        const assistantMessage = await persistSafetyResponse();
        return { conversationId: input.conversationId, response: { response: { text: crisisResponse }, followUp: null }, assistantMessage, observable: false };
    }
    const validated = responseRun.validated;
    const imminent = validated.safety.risk === "imminent";
    const response = imminent
        ? { response: { text: crisisResponse }, followUp: null } as const
        : { response: validated.response, followUp: validated.followUp };
    const content = response.followUp ? `${response.response.text}\n\n${response.followUp}` : response.response.text;

    let assistantMessage;
    try {
        assistantMessage = await input.repository.saveAssistant({ conversationId: input.conversationId, userMessageId: input.userMessageId, content, responseText: response.response.text, followUp: response.followUp, taskVersion: conversationResponseTask.version });
    } catch {
        assistantMessage = await input.repository.findAssistantReply(input.conversationId, input.userMessageId);
        if (!assistantMessage) {
            await input.repository.updateAIRun(responseRun.runId, { status: "failed", error_code: "ASSISTANT_PERSISTENCE_FAILED", completed_at: new Date().toISOString() });
            throw new Error("ASSISTANT_PERSISTENCE_FAILED");
        }
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
    if (!conversation.observable) {
        return { ...conversation, signalsSaved: 0, signals: [], memoryCandidates: [], patternActions: [] };
    }
    const observation = await processObservationPipeline(input);
    return { ...conversation, ...observation };
}