import { describe, expect, it, vi } from "vitest";

import { evaluateMemory } from "./memory.service.ts";
import { validateMemoryEvaluation } from "./memory.validation.ts";

const signalIds = [
    "30000000-0000-4000-8000-000000000001",
    "30000000-0000-4000-8000-000000000002",
    "30000000-0000-4000-8000-000000000003",
];

function evidence(count: number) {
    return signalIds.slice(0, count).map((id, index) => ({
        id,
        signalType: "focus_difficulty",
        value: { present: true, period: "morning" },
        confidence: 0.7,
        observedAt: `2026-09-${10 + index}T10:00:00Z`,
        sourceMessageId: `20000000-0000-4000-8000-00000000000${index + 1}`,
        sourceExcerpt: "I focus better when the room is quiet.",
    }));
}

function repository(count = 2) {
    return {
        getSupportingSignals: vi.fn().mockResolvedValue(evidence(count)),
        getExistingMemories: vi.fn().mockResolvedValue([]),
        getActiveMemories: vi.fn().mockResolvedValue([]),
        claimRun: vi.fn().mockResolvedValue({ id: "run", status: "started" }),
        updateRun: vi.fn().mockResolvedValue(undefined),
        applyEvaluation: vi.fn().mockResolvedValue({ action: "created", memoryId: "memory", status: "candidate" }),
    };
}

function evaluation(decision: "candidate" | "activate" | "reject" | "update", ids = signalIds.slice(0, 2), existingMemoryId: string | null = null) {
    return JSON.stringify({ decision, memory: { type: "preference", content: "You may focus better in quiet environments." }, confidence: 0.78, reason: "Repeated self-reports support this.", existingMemoryId, evidenceSignalIds: ids });
}

const input = { conversationId: "conversation", userMessageId: "message", observedAt: "2026-09-17T10:00:00Z", currentSignals: [{ signalType: "focus_difficulty" }] };

describe("Memory Service", () => {
    it("takes no action for one weak observation", async () => {
        const data = repository(1);
        const ai = { generate: vi.fn() };
        await expect(evaluateMemory({ repository: data as never, ai, ...input })).resolves.toEqual({ action: "no_action" });
        expect(ai.generate).not.toHaveBeenCalled();
        expect(data.applyEvaluation).not.toHaveBeenCalled();
    });

    it("keeps repeated evidence as a candidate", async () => {
        const data = repository(2);
        const ai = { generate: vi.fn().mockResolvedValue({ content: evaluation("activate"), provider: "fake", model: "fake", latencyMs: 1 }) };
        await evaluateMemory({ repository: data as never, ai, ...input });
        expect(data.applyEvaluation).toHaveBeenCalledWith(expect.objectContaining({ runId: "run", status: "candidate", confidence: 0.65 }));
    });

    it("activates only with at least three distinct supporting observations", async () => {
        const data = repository(3);
        data.applyEvaluation.mockResolvedValue({ action: "created", memoryId: "memory", status: "active" });
        const ai = { generate: vi.fn().mockResolvedValue({ content: evaluation("activate", signalIds), provider: "fake", model: "fake", latencyMs: 1 }) };
        await evaluateMemory({ repository: data as never, ai, ...input });
        expect(data.applyEvaluation).toHaveBeenCalledWith(expect.objectContaining({ status: "active", evidenceSignalIds: signalIds }));
    });

    it("updates a similar memory instead of creating a duplicate", async () => {
        const data = repository(2);
        data.getExistingMemories.mockResolvedValue([{ id: "40000000-0000-4000-8000-000000000001", memoryType: "recurring_experience", content: "You may often find it difficult to focus.", status: "active", confidence: 0.72, evidenceCount: 3, lastObservedAt: "2026-09-10T10:00:00Z", canonicalKey: "focus_difficulty:true:morning" }]);
        const ai = { generate: vi.fn().mockResolvedValue({ content: evaluation("update"), provider: "fake", model: "fake", latencyMs: 1 }) };
        await evaluateMemory({ repository: data as never, ai, ...input });
        expect(data.applyEvaluation).toHaveBeenCalledWith(expect.objectContaining({ targetMemoryId: "40000000-0000-4000-8000-000000000001", status: "active" }));
    });

    it("does not merge unrelated memories", async () => {
        const data = repository(2);
        data.getExistingMemories.mockResolvedValue([{ id: "40000000-0000-4000-8000-000000000001", memoryType: "routine", content: "You prefer early morning walks.", status: "active", confidence: 0.7, evidenceCount: 3, lastObservedAt: "2026-09-10T10:00:00Z", canonicalKey: "routine:false" }]);
        const ai = { generate: vi.fn().mockResolvedValue({ content: evaluation("candidate"), provider: "fake", model: "fake", latencyMs: 1 }) };
        await evaluateMemory({ repository: data as never, ai, ...input });
        expect(data.applyEvaluation).toHaveBeenCalledWith(expect.objectContaining({ targetMemoryId: null }));
    });

    it("ignores a model-supplied ID for an unrelated memory", async () => {
        const data = repository(2);
        const unrelatedId = "40000000-0000-4000-8000-000000000001";
        data.getExistingMemories.mockResolvedValue([{ id: unrelatedId, memoryType: "routine", content: "You prefer early morning walks.", status: "active", confidence: 0.7, evidenceCount: 3, lastObservedAt: "2026-09-10T10:00:00Z", canonicalKey: "routine:false" }]);
        const ai = { generate: vi.fn().mockResolvedValue({ content: evaluation("update", signalIds.slice(0, 2), unrelatedId), provider: "fake", model: "fake", latencyMs: 1 }) };
        await evaluateMemory({ repository: data as never, ai, ...input });
        expect(data.applyEvaluation).toHaveBeenCalledWith(expect.objectContaining({ targetMemoryId: null, status: "candidate" }));
    });

    it("does not persist a rejected suggestion without an existing memory", async () => {
        const data = repository(2);
        const ai = { generate: vi.fn().mockResolvedValue({ content: evaluation("reject"), provider: "fake", model: "fake", latencyMs: 1 }) };
        await expect(evaluateMemory({ repository: data as never, ai, ...input })).resolves.toEqual({ action: "no_action" });
        expect(data.applyEvaluation).not.toHaveBeenCalled();
    });

    it("moves contradictory evidence to review instead of creating a duplicate", async () => {
        const data = repository(2);
        const memoryId = "40000000-0000-4000-8000-000000000001";
        data.getExistingMemories.mockResolvedValue([{ id: memoryId, memoryType: "recurring_experience", content: "You may often find it difficult to focus.", status: "active", confidence: 0.75, evidenceCount: 4, lastObservedAt: "2026-09-10T10:00:00Z", canonicalKey: "focus_difficulty:true:morning" }]);
        const ai = { generate: vi.fn().mockResolvedValue({ content: evaluation("reject", signalIds.slice(0, 2), memoryId), provider: "fake", model: "fake", latencyMs: 1 }) };
        await evaluateMemory({ repository: data as never, ai, ...input });
        expect(data.applyEvaluation).toHaveBeenCalledWith(expect.objectContaining({ targetMemoryId: memoryId, status: "candidate" }));
    });

    it("creates nothing when AI fails or returns malformed output", async () => {
        const failed = repository(2);
        await expect(evaluateMemory({ repository: failed as never, ai: { generate: vi.fn().mockRejectedValue(new Error("provider unavailable")) }, ...input })).rejects.toThrow("provider unavailable");
        expect(failed.applyEvaluation).not.toHaveBeenCalled();

        const malformed = repository(2);
        await expect(evaluateMemory({ repository: malformed as never, ai: { generate: vi.fn().mockResolvedValue({ content: "{}", provider: "fake", model: "fake", latencyMs: 1 }) }, ...input })).rejects.toThrow("INVALID_MEMORY_EVALUATION");
        expect(malformed.applyEvaluation).not.toHaveBeenCalled();
    });

    it("does not turn false or conflicting observations into the opposite memory", async () => {
        const falseSignals = repository(2);
        falseSignals.getSupportingSignals.mockResolvedValue(evidence(2).map((item) => ({ ...item, value: { present: false } })));
        const ai = { generate: vi.fn().mockResolvedValue({ content: evaluation("activate"), provider: "fake", model: "fake", latencyMs: 1 }) };
        await expect(evaluateMemory({ repository: falseSignals as never, ai, ...input })).resolves.toEqual({ action: "no_action" });
        expect(falseSignals.applyEvaluation).not.toHaveBeenCalled();

        const conflicting = repository(2);
        conflicting.getSupportingSignals.mockResolvedValue(evidence(2).map((item, index) => ({ ...item, signalType: "energy_change", value: { direction: index === 0 ? "higher" : "lower" } })));
        await expect(evaluateMemory({ repository: conflicting as never, ai, ...input, currentSignals: [{ signalType: "energy_change" }] })).resolves.toEqual({ action: "no_action" });
        expect(conflicting.applyEvaluation).not.toHaveBeenCalled();
    });

    it("does not overwrite an active memory with an opposite canonical claim", async () => {
        const data = repository(2);
        const activeId = "40000000-0000-4000-8000-000000000001";
        data.getSupportingSignals.mockResolvedValue(evidence(2).map((item) => ({ ...item, signalType: "energy_change", value: { direction: "lower" } })));
        data.getExistingMemories.mockResolvedValue([{ id: activeId, memoryType: "recurring_experience", content: "You often report periods of higher energy.", status: "active", confidence: 0.8, evidenceCount: 3, lastObservedAt: "2026-09-10T10:00:00Z", canonicalKey: "energy:higher" }]);
        const ai = { generate: vi.fn().mockResolvedValue({ content: evaluation("update", signalIds.slice(0, 2), activeId), provider: "fake", model: "fake", latencyMs: 1 }) };
        await evaluateMemory({ repository: data as never, ai, ...input, currentSignals: [{ signalType: "energy_change" }] });
        expect(data.applyEvaluation).toHaveBeenCalledWith(expect.objectContaining({ targetMemoryId: null, status: "candidate", canonicalKey: "energy:lower" }));
    });

    it("renders repeated neutral mood evidence without changing its meaning", async () => {
        const data = repository(2);
        data.getSupportingSignals.mockResolvedValue(evidence(2).map((item) => ({ ...item, signalType: "mood_state", value: { state: "neutral" } })));
        const ai = { generate: vi.fn().mockResolvedValue({ content: evaluation("candidate"), provider: "fake", model: "fake", latencyMs: 1 }) };
        await evaluateMemory({ repository: data as never, ai, ...input, currentSignals: [{ signalType: "mood_state" }] });
        expect(data.applyEvaluation).toHaveBeenCalledWith(expect.objectContaining({ evaluation: expect.objectContaining({ memory: { type: "recurring_experience", content: "You often describe your mood as neutral." } }) }));
    });
});

describe("Memory evaluation validation", () => {
    it("rejects invented evidence and invalid confidence shapes", () => {
        expect(() => validateMemoryEvaluation(JSON.stringify({ decision: "activate", memory: { type: "preference", content: "A useful grounded memory." }, confidence: 2, reason: "Repeated", existingMemoryId: null, evidenceSignalIds: signalIds.slice(0, 2) }))).toThrow("INVALID_MEMORY_EVALUATION");
        expect(() => validateMemoryEvaluation("not json")).toThrow("INVALID_MEMORY_EVALUATION");
    });

    it("rejects diagnostic and personality assertions", () => {
        const base = { decision: "activate", memory: { type: "recurring_experience", content: "You show signs of obsessive-compulsive disorder." }, confidence: 0.7, reason: "Repeated", existingMemoryId: null, evidenceSignalIds: signalIds.slice(0, 2) };
        expect(() => validateMemoryEvaluation(JSON.stringify(base))).toThrow("INVALID_MEMORY_EVALUATION");
        expect(() => validateMemoryEvaluation(JSON.stringify({ ...base, memory: { type: "context", content: "You are an introvert who avoids people." } }))).toThrow("INVALID_MEMORY_EVALUATION");
    });

    it("rejects unsupported memory types", () => {
        expect(() => validateMemoryEvaluation(JSON.stringify({ decision: "candidate", memory: { type: "diagnosis", content: "You may focus better in quiet environments." }, confidence: 0.6, reason: "Repeated", existingMemoryId: null, evidenceSignalIds: signalIds.slice(0, 2) }))).toThrow("INVALID_MEMORY_EVALUATION");
    });
});
