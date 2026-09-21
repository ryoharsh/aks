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
        getSupportedPatterns: vi.fn().mockResolvedValue([]),
        getActiveExperiments: vi.fn().mockResolvedValue([]),
        getRelevantLearnings: vi.fn().mockResolvedValue([]),
        getSignalsForMessage: vi.fn().mockResolvedValue([]),
        saveAssistant: vi.fn().mockResolvedValue({ id: "assistant", conversationId: "conversation", role: "assistant", content: "What makes beginning difficult?", replyToMessageId: "user-message", metadata: {}, createdAt: "2026-09-17T10:00:01Z" }),
        saveSignals: vi.fn().mockImplementation(({ signals }) => Promise.resolve(signals.map((signal: { signalType: string; value: unknown; confidence: number | null }, index: number) => ({ id: `30000000-0000-4000-8000-00000000000${index}`, ...signal, observedAt: "2026-09-17T10:00:00Z", sourceMessageId: "user-message" })))),
        claimAIRun: vi.fn().mockImplementation(({ task }) => Promise.resolve({ id: `run-${task}`, status: "started" })),
        claimRegenerationRun: vi.fn().mockImplementation(({ task }) => Promise.resolve({ id: `regen-${task}`, status: "started" })),
        replaceAssistant: vi.fn().mockImplementation(({ messageId, content }) => Promise.resolve({ id: messageId, conversationId: "conversation", role: "assistant", content, replyToMessageId: "user-message", metadata: {}, createdAt: "2026-09-17T10:00:02Z" })),
        updateAIRun: vi.fn().mockResolvedValue(undefined),
        reconcileAIRun: vi.fn().mockResolvedValue(undefined),
    };
}

function storedReply() {
    return {
        id: "assistant",
        conversationId: "conversation",
        role: "assistant" as const,
        content: "Saved response",
        replyToMessageId: "user-message",
        metadata: { response_text: "Saved response", follow_up: null },
        createdAt: "2026-09-17T10:00:01Z",
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
        data.findAssistantReply.mockResolvedValue(storedReply());
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

    it("regenerates in place: same turn, same message id, no duplicate reply", async () => {
        const data = repository();
        data.findAssistantReply.mockResolvedValue(storedReply());
        const ai = { generate: vi.fn().mockResolvedValue({
            content: '{"safety":{"risk":"none"},"response":{"text":"A different question?"},"followUp":"What changed?"}',
            provider: "fake",
            model: "fake-model",
            latencyMs: 3,
        }) };

        const result = await processConversationTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai, regenerate: true });

        expect(data.claimRegenerationRun).toHaveBeenCalledWith({ conversationId: "conversation", userMessageId: "user-message", task: "conversation_response" });
        expect(data.claimAIRun).not.toHaveBeenCalled();
        expect(data.saveAssistant).not.toHaveBeenCalled();
        expect(data.replaceAssistant).toHaveBeenCalledWith(expect.objectContaining({ messageId: "assistant", content: "A different question?\n\nWhat changed?" }));
        expect(result.assistantMessage.id).toBe("assistant");
        expect(result.response.response.text).toBe("A different question?");
    });

    it("refuses to regenerate a turn that has no assistant reply", async () => {
        const data = repository();
        const ai = { generate: vi.fn() };

        await expect(processConversationTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai, regenerate: true }))
            .rejects.toThrow("NOTHING_TO_REGENERATE");
        expect(ai.generate).not.toHaveBeenCalled();
        expect(data.saveAssistant).not.toHaveBeenCalled();
    });

    it("leaves the visible reply untouched when regeneration fails", async () => {
        const data = repository();
        data.findAssistantReply.mockResolvedValue(storedReply());
        const ai = { generate: vi.fn().mockRejectedValue(new Error("provider unavailable")) };

        await expect(processConversationTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai, regenerate: true }))
            .rejects.toThrow("provider unavailable");

        expect(data.replaceAssistant).not.toHaveBeenCalled();
        expect(data.saveAssistant).not.toHaveBeenCalled();
        expect(data.updateAIRun).toHaveBeenCalledWith("regen-conversation_response", expect.objectContaining({ status: "failed" }));
    });

    it("replaces the reply with the controlled safety response when the regenerated turn is imminent risk", async () => {
        const data = repository();
        data.findAssistantReply.mockResolvedValue(storedReply());
        const ai = { generate: vi.fn().mockResolvedValue({
            content: '{"safety":{"risk":"imminent"},"response":{"text":"I should not respond normally."},"followUp":"Ask more"}',
            provider: "fake",
            model: "fake-model",
            latencyMs: 3,
        }) };

        const result = await processConversationTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai, regenerate: true });

        expect(data.replaceAssistant).toHaveBeenCalledWith(expect.objectContaining({ messageId: "assistant", content: expect.stringContaining("emergency services"), followUp: null, taskVersion: "safety_response_v1" }));
        expect(result.observable).toBe(false);
    });

    it("does not re-run observations when a turn is regenerated", async () => {
        const data = repository();
        data.findAssistantReply.mockResolvedValue(storedReply());
        const ai = { generate: vi.fn().mockResolvedValue({
            content: '{"safety":{"risk":"none"},"response":{"text":"A different question?"},"followUp":null}',
            provider: "fake",
            model: "fake-model",
            latencyMs: 3,
        }) };

        const result = await processMirrorTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai, regenerate: true });

        expect(result.signalsSaved).toBe(0);
        expect(data.getSignalsForMessage).not.toHaveBeenCalled();
        expect(data.saveSignals).not.toHaveBeenCalled();
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

    it("answers in the language the client is displaying", async () => {
        const data = repository();
        data.getPreferences.mockResolvedValue({ whatExploring: [], whatToNotice: [], language: "hi" });
        const ai = { generate: vi.fn().mockResolvedValue({
            content: '{"safety":{"risk":"none"},"response":{"text":"शुरू करना कठिन लगता है?"},"followUp":null}',
            provider: "fake",
            model: "fake-model",
            latencyMs: 2,
        }) };

        await processConversationTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai, responseLanguage: "ja" });

        // The request wins over the stored preference: a language switched
        // while offline is applied to the UI immediately, while its server sync
        // is best-effort, so the request is the more current signal.
        expect(ai.generate.mock.calls[0][0].context.responseLanguage).toEqual({ code: "ja", name: "Japanese", nativeName: "日本語" });
    });

    it("falls back to the account's stored language when the request carries none", async () => {
        const data = repository();
        data.getPreferences.mockResolvedValue({ whatExploring: [], whatToNotice: [], language: "ur" });
        const ai = { generate: vi.fn().mockResolvedValue({
            content: '{"safety":{"risk":"none"},"response":{"text":"ٹھیک ہے؟"},"followUp":null}',
            provider: "fake",
            model: "fake-model",
            latencyMs: 2,
        }) };

        await processConversationTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai });

        expect(ai.generate.mock.calls[0][0].context.responseLanguage.code).toBe("ur");
    });

    it("answers in English when neither the request nor the account names a language", async () => {
        const data = repository();
        const ai = { generate: vi.fn().mockResolvedValue({
            content: '{"safety":{"risk":"none"},"response":{"text":"What makes beginning difficult?"},"followUp":null}',
            provider: "fake",
            model: "fake-model",
            latencyMs: 2,
        }) };

        await processConversationTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai });

        expect(ai.generate.mock.calls[0][0].context.responseLanguage.code).toBe("en");
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

    it("detects imminent risk written in another language and stores the response in that language", async () => {
        const data = repository();
        data.getUserMessage.mockResolvedValue({ id: "user-message", content: "मैं आत्महत्या करना चाहता हूँ", createdAt: "2026-09-17T10:00:00Z" });
        data.saveAssistant.mockImplementation(({ content }) => Promise.resolve({ id: "assistant", conversationId: "conversation", role: "assistant", content, replyToMessageId: "user-message", metadata: {}, createdAt: "2026-09-17T10:00:01Z" }));
        const ai = { generate: vi.fn() };

        const result = await processConversationTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai, responseLanguage: "hi" });

        // The stored message is the localized one, so every surface that reads
        // the conversation — history, timeline, export, spoken replies — shows
        // the safety text in the language the user is reading.
        expect(result.assistantMessage.content).toContain("आपातकालीन");
        expect(result.response.response.text).toContain("आपातकालीन");
        expect(data.saveAssistant).toHaveBeenCalledWith(expect.objectContaining({ taskVersion: "safety_response_v1" }));
        expect(ai.generate).not.toHaveBeenCalled();
    });

    it("uses the account's stored language for the crisis response when the request has none", async () => {
        const data = repository();
        data.getUserMessage.mockResolvedValue({ id: "user-message", content: "I want to end my life", createdAt: "2026-09-17T10:00:00Z" });
        data.getPreferences.mockResolvedValue({ whatExploring: [], whatToNotice: [], language: "ja" });
        data.saveAssistant.mockImplementation(({ content }) => Promise.resolve({ id: "assistant", conversationId: "conversation", role: "assistant", content, replyToMessageId: "user-message", metadata: {}, createdAt: "2026-09-17T10:00:01Z" }));

        const result = await processConversationTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai: { generate: vi.fn() } });

        expect(result.assistantMessage.content).toContain("緊急");
    });

    it("still returns the crisis response when the preference read fails", async () => {
        // The safety response must not depend on a successful profile lookup: a
        // database problem degrades to English, never to no emergency message.
        const data = repository();
        data.getUserMessage.mockResolvedValue({ id: "user-message", content: "I want to end my life", createdAt: "2026-09-17T10:00:00Z" });
        data.getPreferences.mockRejectedValue(new Error("CONTEXT_UNAVAILABLE"));
        data.saveAssistant.mockImplementation(({ content }) => Promise.resolve({ id: "assistant", conversationId: "conversation", role: "assistant", content, replyToMessageId: "user-message", metadata: {}, createdAt: "2026-09-17T10:00:01Z" }));

        const result = await processConversationTurn({ repository: data as never, conversationId: "conversation", userMessageId: "user-message", ai: { generate: vi.fn() } });

        expect(result.assistantMessage.content).toContain("emergency services");
        expect(result.observable).toBe(false);
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
