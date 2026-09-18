import { describe, expect, it, vi } from "vitest";

import { processConversationTurn, processMirrorTurn, processObservationPipeline } from "./mirror.core.ts";
import { AIProviderError } from "../ai/types.ts";

function repository() {
    return {
        getConversation: vi.fn().mockResolvedValue({ id: "conversation", title: "Starting work" }),
        getUserMessage: vi.fn().mockResolvedValue({ id: "user-message", content: "Starting is difficult.", createdAt: "2026-09-17T10:00:00Z" }),
        findAssistantReply: vi.fn().mockResolvedValue(null),
        getRecentMessages: vi.fn().mockResolvedValue([]),
        getRecentSignals: vi.fn().mockResolvedValue([]),
        getPreferences: vi.fn().mockResolvedValue({ whatExploring: [], whatToNotice: [] }),
        getSignalsForMessage: vi.fn().mockResolvedValue([]),
        saveAssistant: vi.fn().mockResolvedValue({ id: "assistant", conversationId: "conversation", role: "assistant", content: "What makes beginning difficult?", replyToMessageId: "user-message", metadata: {}, createdAt: "2026-09-17T10:00:01Z" }),
        saveSignals: vi.fn().mockImplementation(({ signals }) => Promise.resolve(signals.map((signal: { signalType: string; value: unknown; confidence: number | null }, index: number) => ({ id: `30000000-0000-4000-8000-00000000000${index}`, ...signal, observedAt: "2026-09-17T10:00:00Z", sourceMessageId: "user-message" })))),
        claimAIRun: vi.fn().mockImplementation(({ task }) => Promise.resolve({ id: `run-${task}`, status: "started" })),
        updateAIRun: vi.fn().mockResolvedValue(undefined),
        reconcileAIRun: vi.fn().mockResolvedValue(undefined),
    };
}

describe("MirrorCore", () => {
    it("saves a validated assistant response and traceable signals", async () => {
        const data = repository();
        const ai = { generate: vi.fn().mockImplementation(({ task }) => Promise.resolve({
            content: task === "conversation_response"
                ? '{"safety":{"risk":"none"},"response":{"text":"What makes beginning difficult?"},"followUp":null}'
                : '{"signals":[{"signalType":"difficulty_starting","value":{"present":true},"confidence":0.8}]}',
            provider: "fake",
            model: "fake-model",
            latencyMs: 2,
        })) };

        const result = await processMirrorTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai });
        expect(result.assistantMessage.id).toBe("assistant");
        expect(data.saveSignals).toHaveBeenCalledWith(expect.objectContaining({ userMessageId: "user-message" }));
        expect(result.signals).toHaveLength(1);
    });

    it("does not save an assistant response when the provider fails", async () => {
        const data = repository();
        const ai = { generate: vi.fn().mockRejectedValue(new Error("provider unavailable")) };
        await expect(processMirrorTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai })).rejects.toThrow("provider unavailable");
        expect(data.saveAssistant).not.toHaveBeenCalled();
        expect(data.updateAIRun).toHaveBeenCalledWith("run-conversation_response", expect.objectContaining({ status: "failed" }));
    });

    it("reuses a persisted reply without generating it again", async () => {
        const data = repository();
        data.findAssistantReply.mockResolvedValue({
            id: "assistant",
            conversationId: "conversation",
            role: "assistant",
            content: "Saved response",
            replyToMessageId: "user-message",
            metadata: { response_text: "Saved response", follow_up: null },
            createdAt: "2026-09-17T10:00:01Z",
        });
        data.getSignalsForMessage.mockResolvedValue([{ signalType: "difficulty_starting", value: { present: true }, confidence: 0.8 }]);
        const ai = { generate: vi.fn() };

        const result = await processMirrorTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai });
        expect(result.assistantMessage.content).toBe("Saved response");
        expect(ai.generate).not.toHaveBeenCalled();
    });

    it("uses the deterministic crisis response without sending content to the provider", async () => {
        const data = repository();
        data.getUserMessage.mockResolvedValue({ id: "user-message", content: "I want to end my life", createdAt: "2026-09-17T10:00:00Z" });
        data.saveAssistant.mockImplementation(({ content }) => Promise.resolve({ id: "assistant", conversationId: "conversation", role: "assistant", content, replyToMessageId: "user-message", metadata: {}, createdAt: "2026-09-17T10:00:01Z" }));
        const ai = { generate: vi.fn() };

        const result = await processMirrorTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai });
        expect(result.assistantMessage.content).toContain("emergency services");
        expect(ai.generate).not.toHaveBeenCalled();
        expect(data.saveSignals).not.toHaveBeenCalled();
    });

    it("replaces the assistant reply with the crisis response when the model flags imminent risk", async () => {
        const data = repository();
        data.saveAssistant.mockImplementation(({ content }) => Promise.resolve({ id: "assistant", conversationId: "conversation", role: "assistant", content, replyToMessageId: "user-message", metadata: {}, createdAt: "2026-09-17T10:00:01Z" }));
        const ai = { generate: vi.fn().mockResolvedValue({
            content: '{"safety":{"risk":"imminent"},"response":{"text":"I should not respond normally."},"followUp":null}',
            provider: "fake",
            model: "fake-model",
            latencyMs: 2,
        }) };

        const result = await processMirrorTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai });
        expect(result.assistantMessage.content).toContain("emergency services");
        expect(data.saveSignals).not.toHaveBeenCalled();
    });

    it("falls back to the crisis response when the provider blocks the input for content policy", async () => {
        const data = repository();
        data.saveAssistant.mockImplementation(({ content }) => Promise.resolve({ id: "assistant", conversationId: "conversation", role: "assistant", content, replyToMessageId: "user-message", metadata: {}, createdAt: "2026-09-17T10:00:01Z" }));
        const ai = { generate: vi.fn().mockRejectedValue(new AIProviderError("AI_PROVIDER_UNAVAILABLE", true)) };

        const result = await processMirrorTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai });
        expect(result.assistantMessage.content).toContain("emergency services");
        expect(data.saveSignals).not.toHaveBeenCalled();
        expect(data.updateAIRun).toHaveBeenCalledWith("run-conversation_response", expect.objectContaining({ status: "failed" }));
    });

    it("evaluates memory after signals without coupling it to response persistence", async () => {
        const data = repository();
        const memoryRepository = {
            getSupportingSignals: vi.fn().mockResolvedValue([
                { id: "30000000-0000-4000-8000-000000000001", signalType: "difficulty_starting", value: { present: true }, confidence: 0.7, observedAt: "2026-09-16T10:00:00Z", sourceMessageId: "20000000-0000-4000-8000-000000000001", sourceExcerpt: "Large tasks are hard to begin." },
                { id: "30000000-0000-4000-8000-000000000002", signalType: "difficulty_starting", value: { present: true }, confidence: 0.8, observedAt: "2026-09-17T10:00:00Z", sourceMessageId: "20000000-0000-4000-8000-000000000002", sourceExcerpt: "I struggle to start unclear projects." },
            ]),
            getExistingMemories: vi.fn().mockResolvedValue([]),
            getActiveMemories: vi.fn().mockResolvedValue([]),
            claimRun: vi.fn().mockResolvedValue({ id: "memory-run", status: "started" }),
            updateRun: vi.fn().mockResolvedValue(undefined),
            applyEvaluation: vi.fn().mockResolvedValue({ action: "created", memoryId: "memory", status: "candidate" }),
        };
        const ai = { generate: vi.fn().mockImplementation(({ task }) => Promise.resolve({
            content: task === "conversation_response"
                ? '{"safety":{"risk":"none"},"response":{"text":"What makes beginning difficult?"},"followUp":null}'
                : task === "signal_extraction"
                    ? '{"signals":[{"signalType":"difficulty_starting","value":{"present":true},"confidence":0.8}]}'
                    : '{"decision":"candidate","memory":{"type":"recurring_experience","content":"You may find large or unclear tasks harder to start."},"confidence":0.65,"reason":"Repeated self-reports support this.","existingMemoryId":null,"evidenceSignalIds":["30000000-0000-4000-8000-000000000001","30000000-0000-4000-8000-000000000002"]}',
            provider: "fake",
            model: "fake-model",
            latencyMs: 2,
        })) };

        const result = await processMirrorTurn({ repository: data as never, memoryRepository: memoryRepository as never, conversationId: "conversation", userMessageId: "user-message", ai });
        expect(memoryRepository.applyEvaluation).toHaveBeenCalled();
        expect(result.memoryCandidates).toEqual([{ action: "created", memoryId: "memory", status: "candidate" }]);
    });

    it("runs pattern analysis independently after signal persistence", async () => {
        const data = repository();
        const patternSignals = [0, 1, 2].map((index) => ({ id: `30000000-0000-4000-8000-00000000001${index}`, signalType: "difficulty_starting", value: { present: true }, conceptKey: 'difficulty_starting:{"present":true}', observedAt: `2026-09-${10 + index}T10:00:00Z`, sourceKey: `message:${index}`, sourceExcerpt: null }));
        const patternRepository = {
            countSignals: vi.fn().mockResolvedValue({ difficulty_starting: 3 }),
            getRecentSignals: vi.fn().mockResolvedValue(patternSignals),
            getExistingPatterns: vi.fn().mockResolvedValue([]),
            getRelevantMemories: vi.fn().mockResolvedValue([]),
            claimRun: vi.fn().mockResolvedValue({ id: "pattern-run", status: "started" }),
            updateRun: vi.fn().mockResolvedValue(undefined),
            applyProposal: vi.fn().mockResolvedValue({ action: "created", patternId: "pattern", status: "candidate" }),
        };
        const ai = { generate: vi.fn().mockImplementation(({ task }) => Promise.resolve({
            content: task === "conversation_response"
                ? '{"safety":{"risk":"none"},"response":{"text":"What makes beginning difficult?"},"followUp":null}'
                : task === "signal_extraction"
                    ? '{"signals":[{"signalType":"difficulty_starting","value":{"present":true},"confidence":0.8}]}'
                    : '{"candidates":[{"decision":"create","title":"Starting difficulty may repeat","description":"Difficulty starting may appear across separate observations.","relationship":"recurrence","conceptKeys":["difficulty_starting:{\\"present\\":true}"],"confidence":0.6,"signalIds":["30000000-0000-4000-8000-000000000010","30000000-0000-4000-8000-000000000011","30000000-0000-4000-8000-000000000012"],"existingPatternId":null,"alternativeExplanation":null}]}' ,
            provider: "fake",
            model: "fake-model",
            latencyMs: 2,
        })) };

        const result = await processMirrorTurn({ repository: data as never, patternRepository: patternRepository as never, conversationId: "conversation", userMessageId: "user-message", ai });
        expect(patternRepository.applyProposal).toHaveBeenCalled();
        expect(result.patternActions).toEqual([{ action: "created", patternId: "pattern", status: "candidate" }]);
    });

    it("processConversationTurn returns a response without running observation", async () => {
        const data = repository();
        const ai = { generate: vi.fn().mockResolvedValue({
            content: '{"safety":{"risk":"none"},"response":{"text":"What makes beginning difficult?"},"followUp":null}',
            provider: "fake",
            model: "fake-model",
            latencyMs: 2,
        }) };

        const result = await processConversationTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai });
        expect(result.assistantMessage.id).toBe("assistant");
        expect(result.observable).toBe(true);
        expect(data.getSignalsForMessage).not.toHaveBeenCalled();
        expect(data.saveSignals).not.toHaveBeenCalled();
    });

    it("processConversationTurn sets observable false for a crisis message", async () => {
        const data = repository();
        data.getUserMessage.mockResolvedValue({ id: "user-message", content: "I want to end my life", createdAt: "2026-09-17T10:00:00Z" });
        data.saveAssistant.mockImplementation(({ content }) => Promise.resolve({ id: "assistant", conversationId: "conversation", role: "assistant", content, replyToMessageId: "user-message", metadata: {}, createdAt: "2026-09-17T10:00:01Z" }));
        const ai = { generate: vi.fn() };

        const result = await processConversationTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai });
        expect(result.observable).toBe(false);
        expect(result.assistantMessage.content).toContain("emergency services");
    });

    it("processObservationPipeline never throws and persists signals", async () => {
        const data = repository();
        data.getSignalsForMessage.mockResolvedValue([]);
        data.getUserMessage.mockResolvedValue({ id: "user-message", content: "Starting is difficult.", createdAt: "2026-09-17T10:00:00Z" });
        const ai = { generate: vi.fn().mockResolvedValue({
            content: '{"signals":[{"signalType":"difficulty_starting","value":{"present":true},"confidence":0.8}]}',
            provider: "fake",
            model: "fake-model",
            latencyMs: 2,
        }) };

        const result = await processObservationPipeline({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai });
        expect(result.signalsSaved).toBe(1);
        expect(data.saveSignals).toHaveBeenCalled();
    });

    it("processObservationPipeline returns empty results on error instead of throwing", async () => {
        const data = repository();
        data.getUserMessage.mockRejectedValue(new Error("MESSAGE_UNAVAILABLE"));
        const ai = { generate: vi.fn() };

        const result = await processObservationPipeline({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai });
        expect(result.signalsSaved).toBe(0);
        expect(result.signals).toEqual([]);
        expect(ai.generate).not.toHaveBeenCalled();
    });
});
