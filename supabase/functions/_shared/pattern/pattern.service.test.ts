import { describe, expect, it, vi } from "vitest";

import { analyzePatterns } from "./pattern.service.ts";
import { validatePatternAnalysis } from "./pattern.validation.ts";

const ids = Array.from({ length: 8 }, (_, index) => `30000000-0000-4000-8000-0000000000${index + 10}`);
const difficultyKey = 'difficulty_starting:{"present":true}';
const lowEnergyKey = 'energy_change:{"direction":"lower"}';

function recurrenceSignals(count = 3) {
    return ids.slice(0, count).map((id, index) => ({ id, signalType: "difficulty_starting", value: { present: true }, conceptKey: difficultyKey, observedAt: `2026-09-${10 + index}T10:00:00Z`, sourceKey: `message:${index}`, sourceExcerpt: "Starting a large task felt difficult." }));
}

function repository(signals = recurrenceSignals()) {
    return {
        countSignals: vi.fn().mockResolvedValue({ difficulty_starting: signals.length, energy_change: signals.length }),
        getRecentSignals: vi.fn().mockResolvedValue(signals),
        getExistingPatterns: vi.fn().mockResolvedValue([]),
        getRelevantMemories: vi.fn().mockResolvedValue([]),
        claimRun: vi.fn().mockResolvedValue({ id: "pattern-run", status: "started" }),
        updateRun: vi.fn().mockResolvedValue(undefined),
        applyProposal: vi.fn().mockResolvedValue({ action: "created", patternId: "pattern", status: "candidate" }),
    };
}

function response(overrides: Record<string, unknown> = {}) {
    return JSON.stringify({ candidates: [{ decision: "create", title: "Starting difficulty may repeat", description: "Difficulty starting may appear across several separate observations.", relationship: "recurrence", conceptKeys: [difficultyKey], confidence: 0.68, signalIds: ids.slice(0, 3), existingPatternId: null, alternativeExplanation: null, ...overrides }] });
}

const input = { conversationId: "conversation", userMessageId: "message", observedAt: "2026-09-17T10:00:00Z", currentSignals: [{ signalType: "difficulty_starting" }] };

describe("Pattern Service", () => {
    it("does nothing without enough distinct observations", async () => {
        const data = repository(recurrenceSignals(1));
        const ai = { generate: vi.fn() };
        await expect(analyzePatterns({ repository: data as never, ai, ...input })).resolves.toEqual([]);
        expect(ai.generate).not.toHaveBeenCalled();
    });

    it("creates a candidate from three repeated observations", async () => {
        const data = repository();
        const ai = { generate: vi.fn().mockResolvedValue({ content: response(), provider: "fake", model: "fake", latencyMs: 1 }) };
        await analyzePatterns({ repository: data as never, ai, ...input });
        expect(data.applyProposal).toHaveBeenCalledWith(expect.objectContaining({ canonicalKey: `recurrence|${difficultyKey}`, status: "candidate", signalIds: ids.slice(0, 3) }));
    });

    it("deduplicates different wording through the canonical relationship key", async () => {
        const data = repository();
        data.getExistingPatterns.mockResolvedValue([{ id: "40000000-0000-4000-8000-000000000010", title: "An older title", description: "An older uncertain description.", canonicalKey: `recurrence|${difficultyKey}`, status: "candidate", confidence: 0.55, evidenceCount: 3, relationship: "recurrence", conceptKeys: [difficultyKey] }]);
        const ai = { generate: vi.fn().mockResolvedValue({ content: response({ title: "Completely different wording", decision: "create" }), provider: "fake", model: "fake", latencyMs: 1 }) };
        await analyzePatterns({ repository: data as never, ai, ...input });
        expect(data.applyProposal).toHaveBeenCalledWith(expect.objectContaining({ targetPatternId: "40000000-0000-4000-8000-000000000010" }));
    });

    it("validates repeated co-occurrence before creating an association", async () => {
        const signals = [0, 1, 2].flatMap((group, index) => [
            { id: ids[index * 2], signalType: "difficulty_starting", value: { present: true }, conceptKey: difficultyKey, observedAt: `2026-09-${10 + index}T10:00:00Z`, sourceKey: `message:${group}`, sourceExcerpt: null },
            { id: ids[index * 2 + 1], signalType: "energy_change", value: { direction: "lower" }, conceptKey: lowEnergyKey, observedAt: `2026-09-${10 + index}T10:00:00Z`, sourceKey: `message:${group}`, sourceExcerpt: null },
        ]);
        const data = repository(signals);
        const ai = { generate: vi.fn().mockResolvedValue({ content: response({ relationship: "association", conceptKeys: [difficultyKey, lowEnergyKey], signalIds: ids.slice(0, 6) }), provider: "fake", model: "fake", latencyMs: 1 }) };
        await analyzePatterns({ repository: data as never, ai, ...input, currentSignals: [{ signalType: "difficulty_starting" }, { signalType: "energy_change" }] });
        expect(data.applyProposal).toHaveBeenCalledWith(expect.objectContaining({ status: "possible", evidenceRelationship: "supporting" }));
    });

    it("rejects a fabricated signal ID", async () => {
        const data = repository();
        const ai = { generate: vi.fn().mockResolvedValue({ content: response({ signalIds: [ids[0], ids[1], "90000000-0000-4000-8000-000000000099"] }), provider: "fake", model: "fake", latencyMs: 1 }) };
        await expect(analyzePatterns({ repository: data as never, ai, ...input })).rejects.toThrow("INVALID_PATTERN_EVIDENCE");
        expect(data.applyProposal).not.toHaveBeenCalled();
    });

    it("takes no action when an identical analysis already succeeded", async () => {
        const data = repository();
        data.claimRun.mockResolvedValue({ id: "pattern-run", status: "succeeded" });
        const ai = { generate: vi.fn() };
        await expect(analyzePatterns({ repository: data as never, ai, ...input })).resolves.toEqual([]);
        expect(ai.generate).not.toHaveBeenCalled();
    });

    it("creates no pattern when AI is unavailable", async () => {
        const data = repository();
        const ai = { generate: vi.fn().mockRejectedValue(new Error("provider unavailable")) };
        await expect(analyzePatterns({ repository: data as never, ai, ...input })).rejects.toThrow("provider unavailable");
        expect(data.applyProposal).not.toHaveBeenCalled();
        expect(data.updateRun).toHaveBeenCalledWith("pattern-run", expect.objectContaining({ status: "failed" }));
    });

    it("does not treat an opposite recurring value as disproof of an existing recurrence", async () => {
        const data = repository();
        const patternId = "40000000-0000-4000-8000-000000000010";
        data.getExistingPatterns.mockResolvedValue([{ id: patternId, title: "Difficulty starting appears repeatedly", description: "This may recur.", canonicalKey: "recurrence|difficulty_starting:{\"present\":false}", status: "possible", confidence: 0.7, evidenceCount: 5, relationship: "recurrence", conceptKeys: ['difficulty_starting:{"present":false}'] }]);
        const ai = { generate: vi.fn().mockResolvedValue({ content: response({ decision: "not_supported", existingPatternId: patternId }), provider: "fake", model: "fake", latencyMs: 1 }) };
        await analyzePatterns({ repository: data as never, ai, ...input });
        await expect(analyzePatterns({ repository: data as never, ai, ...input })).resolves.toEqual([]);
        expect(data.applyProposal).not.toHaveBeenCalled();
    });

    it("keeps false boolean evidence negative in displayed pattern wording", async () => {
        const falseKey = 'difficulty_starting:{"present":false}';
        const signals = recurrenceSignals().map((signal) => ({ ...signal, value: { present: false }, conceptKey: falseKey }));
        const data = repository(signals);
        const ai = { generate: vi.fn().mockResolvedValue({ content: response({ conceptKeys: [falseKey], signalIds: ids.slice(0, 3) }), provider: "fake", model: "fake", latencyMs: 1 }) };
        await analyzePatterns({ repository: data as never, ai, ...input });
        expect(data.applyProposal).toHaveBeenCalledWith(expect.objectContaining({ title: "Starting without reported difficulty appears repeatedly" }));
    });
});

describe("Pattern analysis validation", () => {
    it("rejects invalid confidence, causal claims, and fabricated shapes", () => {
        expect(() => validatePatternAnalysis(response({ confidence: 1.2 }))).toThrow("INVALID_PATTERN_ANALYSIS");
        expect(() => validatePatternAnalysis(response({ description: "This proves one signal causes another." }))).toThrow("INVALID_PATTERN_ANALYSIS");
        expect(() => validatePatternAnalysis("{}" )).toThrow("INVALID_PATTERN_ANALYSIS");
    });
});
