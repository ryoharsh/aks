import { describe, expect, it, vi } from "vitest";

import { createLearningService } from "./learning.service.ts";
import { validateLearningSynthesis } from "./learning.validation.ts";

const experimentId = "50000000-0000-4000-8000-000000000001";
const learningId = "60000000-0000-4000-8000-000000000001";
const patternId = "40000000-0000-4000-8000-000000000001";

function observations(results: Array<"easier" | "same" | "harder">) {
    return results.map((result, index) => ({ id: `observation-${index}`, value: { result }, notes: null, observed_at: `2026-09-${10 + index}T10:00:00Z` }));
}

function repository(result: "supports" | "mixed" | "does_not_support" | "insufficient_data" = "supports", values: Array<"easier" | "same" | "harder"> = ["easier", "easier", "same", "easier", "harder"]) {
    return {
        getExperiment: vi.fn().mockResolvedValue({ id: experimentId, pattern_id: patternId, title: "Small first step", hypothesis: "A smaller first step may make starting easier.", description: "Try a small first step and record the result.", status: "completed", start_date: "2026-09-10", end_date: "2026-09-15", result, result_summary: "Deterministic summary", confidence: 0.7, metadata: {} }),
        getObservations: vi.fn().mockResolvedValue(observations(values)),
        getPattern: vi.fn().mockResolvedValue({ id: "pattern", title: "Starting difficulty", description: "May repeat", status: "possible" }),
        getExistingLearnings: vi.fn().mockResolvedValue([]),
        findForExperiment: vi.fn().mockResolvedValue(null),
        claimRun: vi.fn().mockResolvedValue({ id: "run", status: "started", attemptToken: "70000000-0000-4000-8000-000000000001" }),
        updateRun: vi.fn().mockResolvedValue(undefined),
        markExperiment: vi.fn().mockResolvedValue(undefined),
        apply: vi.fn().mockResolvedValue({ action: "created", learningId, status: "active" }),
    };
}

function synthesis(overrides: Record<string, unknown> = {}) {
    return JSON.stringify({ decision: "create", learning: { key: "smaller_first_steps", title: "Smaller starts may help", description: "Smaller first steps may make difficult tasks easier to begin." }, confidence: 0.68, sourceExperimentId: experimentId, existingLearningId: null, ...overrides });
}

describe("Learning Core", () => {
    it("creates no learning for no or insufficient observations", async () => {
        const data = repository("insufficient_data", []);
        const ai = { generate: vi.fn() };
        await expect(createLearningService(data as never, ai).synthesize(experimentId)).resolves.toEqual({ action: "no_action" });
        expect(ai.generate).not.toHaveBeenCalled();
        expect(data.markExperiment).toHaveBeenCalledWith(experimentId, "not_applicable");
    });

    it("creates a grounded learning from a supported completed experiment", async () => {
        const data = repository();
        const ai = { generate: vi.fn().mockResolvedValue({ content: synthesis(), provider: "fake", model: "fake", latencyMs: 2 }) };
        const action = await createLearningService(data as never, ai).synthesize(experimentId);
        expect(action).toEqual({ action: "created", learningId, status: "active" });
        expect(data.apply).toHaveBeenCalledWith(expect.objectContaining({ experimentId, relationship: "supports", confidence: 0.68 }));
    });

    it("creates cautious learnings for mixed and negative outcomes", async () => {
        const mixed = repository("mixed", ["easier", "same", "harder"]);
        const mixedAI = { generate: vi.fn().mockResolvedValue({ content: synthesis({ learning: { key: "inconsistent_small_steps", title: "Results may vary", description: "Smaller first steps may help in some situations, but the result appears inconsistent." }, result: undefined }), provider: "fake", model: "fake", latencyMs: 2 }) };
        await createLearningService(mixed as never, mixedAI).synthesize(experimentId);
        expect(mixed.apply).toHaveBeenCalledWith(expect.objectContaining({ relationship: "mixed" }));

        const negative = repository("does_not_support", ["harder", "harder", "same"]);
        const negativeAI = { generate: vi.fn().mockResolvedValue({ content: synthesis({ learning: { key: "small_steps_not_clear", title: "Small starts did not clearly help", description: "Smaller first steps did not clearly make starting easier during this experiment." } }), provider: "fake", model: "fake", latencyMs: 2 }) };
        await createLearningService(negative as never, negativeAI).synthesize(experimentId);
        expect(negative.apply).toHaveBeenCalledWith(expect.objectContaining({ relationship: "contradicts" }));
    });

    it("updates a semantically matching learning from another experiment", async () => {
        const data = repository();
        data.getExistingLearnings.mockResolvedValue([{ id: learningId, title: "Small starts may help", description: "A smaller first step may make difficult tasks easier to begin.", canonicalKey: `pattern_${patternId.replaceAll("-", "")}_smaller_first_steps`, confidence: 0.6, evidenceCount: 5, status: "active", latestResult: "supports", resultCounts: { supports: 1, mixed: 0, doesNotSupport: 0 } }]);
        const ai = { generate: vi.fn().mockResolvedValue({ content: synthesis({ decision: "update", existingLearningId: learningId }), provider: "fake", model: "fake", latencyMs: 2 }) };
        await createLearningService(data as never, ai).synthesize(experimentId);
        expect(data.apply).toHaveBeenCalledWith(expect.objectContaining({ targetLearningId: learningId, status: "active" }));
    });

    it("marks a learning revised when a later experiment reaches a different result", async () => {
        const data = repository("does_not_support", ["harder", "harder", "same"]);
        data.getExistingLearnings.mockResolvedValue([{ id: learningId, title: "Small starts may help", description: "A smaller first step may make difficult tasks easier to begin.", canonicalKey: `pattern_${patternId.replaceAll("-", "")}_smaller_first_steps`, confidence: 0.65, evidenceCount: 5, status: "active", latestResult: "supports", resultCounts: { supports: 1, mixed: 0, doesNotSupport: 0 } }]);
        const ai = { generate: vi.fn().mockResolvedValue({ content: synthesis({ decision: "update", existingLearningId: learningId, learning: { key: "smaller_first_steps", title: "Small starts may not help consistently", description: "Smaller first steps did not clearly help in the later experiment, suggesting the effect may vary." } }), provider: "fake", model: "fake", latencyMs: 2 }) };
        await createLearningService(data as never, ai).synthesize(experimentId);
        expect(data.apply).toHaveBeenCalledWith(expect.objectContaining({ targetLearningId: learningId, status: "revised", relationship: "contradicts" }));
    });

    it("does not duplicate synthesis for the same experiment", async () => {
        const data = repository();
        data.findForExperiment.mockResolvedValue(learningId);
        const ai = { generate: vi.fn() };
        await expect(createLearningService(data as never, ai).synthesize(experimentId)).resolves.toEqual({ action: "no_action", learningId });
        expect(ai.generate).not.toHaveBeenCalled();
        expect(data.apply).not.toHaveBeenCalled();
    });

    it("creates no fake learning when AI fails", async () => {
        const data = repository();
        await expect(createLearningService(data as never, { generate: vi.fn().mockRejectedValue(new Error("provider unavailable")) }).synthesize(experimentId)).rejects.toThrow("provider unavailable");
        expect(data.apply).not.toHaveBeenCalled();
        expect(data.markExperiment).toHaveBeenLastCalledWith(experimentId, "failed");
    });

    it("does not mark a stale fenced synthesis attempt successful", async () => {
        const data = repository();
        data.apply.mockRejectedValue(new Error("LEARNING_SYNTHESIS_SUPPRESSED"));
        const ai = { generate: vi.fn().mockResolvedValue({ content: synthesis(), provider: "fake", model: "fake", latencyMs: 2 }) };
        await expect(createLearningService(data as never, ai).synthesize(experimentId)).resolves.toEqual({ action: "no_action" });
        expect(data.markExperiment).toHaveBeenLastCalledWith(experimentId, "pending");
    });

    it("rejects an unknown experiment source and invalid AI confidence", async () => {
        const unknown = repository();
        unknown.getExperiment.mockRejectedValue(new Error("EXPERIMENT_UNAVAILABLE"));
        await expect(createLearningService(unknown as never, { generate: vi.fn() }).synthesize(experimentId)).rejects.toThrow("EXPERIMENT_UNAVAILABLE");
        expect(() => validateLearningSynthesis(synthesis({ confidence: 2 }), experimentId, "supports")).toThrow("INVALID_LEARNING_SYNTHESIS");
    });

    it("validates the final deterministic learning text before persistence", async () => {
        const data = repository();
        data.getExperiment.mockResolvedValue({ id: experimentId, pattern_id: patternId, title: "Unsafe experiment", hypothesis: "ADHD may cause my difficulty starting.", description: "Test a change.", status: "completed", start_date: "2026-09-10", end_date: "2026-09-15", result: "supports", result_summary: "Deterministic summary", confidence: 0.6, metadata: {} });
        const ai = { generate: vi.fn().mockResolvedValue({ content: synthesis(), provider: "fake", model: "fake", latencyMs: 2 }) };
        await expect(createLearningService(data as never, ai).synthesize(experimentId)).rejects.toThrow("UNSAFE_LEARNING");
        expect(data.apply).not.toHaveBeenCalled();
    });
});
