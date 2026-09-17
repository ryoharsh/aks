import { describe, expect, it, vi } from "vitest";

import { calculateExperimentMetrics, createExperimentService, determineExperimentResult } from "./experiment.service.ts";

const baseExperiment = {
    id: "50000000-0000-4000-8000-000000000001",
    patternId: "40000000-0000-4000-8000-000000000001",
    title: "Ten-minute first step",
    hypothesis: "A smaller first step may make starting feel easier.",
    description: "Try a small first step and record how starting felt.",
    status: "completed" as const,
    startDate: "2026-09-10",
    endDate: "2026-09-15",
    result: null,
    resultSummary: null,
    confidence: null,
    observationCount: 0,
    metadata: {},
    createdAt: "2026-09-10T00:00:00Z",
    updatedAt: "2026-09-15T00:00:00Z",
};

function observations(results: Array<"easier" | "same" | "harder">) {
    return results.map((result, index) => ({ id: `observation-${index}`, experimentId: baseExperiment.id, value: { result }, notes: null, observedAt: `2026-09-${10 + index}T10:00:00Z`, createdAt: `2026-09-${10 + index}T10:00:00Z` }));
}

function repository(results: Array<"easier" | "same" | "harder"> = []) {
    return {
        getPattern: vi.fn().mockResolvedValue({ id: baseExperiment.patternId, status: "possible" }),
        findOpenForPattern: vi.fn().mockResolvedValue(null),
        createDraft: vi.fn().mockResolvedValue({ ...baseExperiment, status: "draft" }),
        getExperiment: vi.fn().mockResolvedValue({ ...baseExperiment, observationCount: results.length }),
        listObservations: vi.fn().mockResolvedValue(observations(results)),
        start: vi.fn().mockResolvedValue({ ...baseExperiment, status: "active" }),
        record: vi.fn().mockResolvedValue({ id: "observation", observedAt: "2026-09-17T10:00:00Z" }),
        finish: vi.fn().mockResolvedValue(baseExperiment),
        cancel: vi.fn().mockResolvedValue({ ...baseExperiment, status: "cancelled" }),
        saveOutcome: vi.fn().mockImplementation((_id, input) => Promise.resolve({ ...baseExperiment, result: input.result, resultSummary: input.summary, confidence: input.confidence, metadata: { metrics: input.metrics, interpretation: input.interpretation, analysis_status: input.analysisStatus } })),
        claimAnalysis: vi.fn().mockResolvedValue({ id: "run", status: "started" }),
        updateRun: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
    };
}

describe("Experiment Core", () => {
    it("creates a validated draft linked to a pattern", async () => {
        const data = repository();
        const service = createExperimentService(data as never, { generate: vi.fn() });
        await service.createDraft({ patternId: baseExperiment.patternId!, title: "Small first step", hypothesis: "A smaller step may make starting easier.", description: "Try ten minutes and record whether starting felt easier.", durationDays: 5 });
        expect(data.createDraft).toHaveBeenCalledWith(expect.objectContaining({ patternId: baseExperiment.patternId, durationDays: 5 }));
    });

    it("starts and records only explicit valid observations", async () => {
        const data = repository();
        const service = createExperimentService(data as never, { generate: vi.fn() });
        await service.start(baseExperiment.id);
        await service.recordObservation({ experimentId: baseExperiment.id, value: { result: "easier" }, notes: "Started quickly", requestId: "request-1" });
        expect(data.start).toHaveBeenCalledWith(baseExperiment.id);
        expect(data.record).toHaveBeenCalledWith(baseExperiment.id, { result: "easier" }, "Started quickly", "request-1");
        await expect(service.recordObservation({ experimentId: baseExperiment.id, value: { result: "invented" }, requestId: "request-2" })).rejects.toThrow("INVALID_OBSERVATION");
    });

    it("calculates deterministic counts and normalized results", () => {
        expect(calculateExperimentMetrics(observations(["easier", "same", "easier", "harder", "easier"]))).toEqual({ total: 5, easier: 3, same: 1, harder: 1 });
        expect(determineExperimentResult({ total: 5, easier: 3, same: 1, harder: 1 })).toBe("supports");
        expect(determineExperimentResult({ total: 5, easier: 1, same: 1, harder: 3 })).toBe("does_not_support");
        expect(determineExperimentResult({ total: 4, easier: 2, same: 0, harder: 2 })).toBe("mixed");
        expect(determineExperimentResult({ total: 2, easier: 2, same: 0, harder: 0 })).toBe("insufficient_data");
    });

    it("completes with insufficient data without calling AI", async () => {
        const data = repository(["easier", "same"]);
        const ai = { generate: vi.fn() };
        const service = createExperimentService(data as never, ai);
        const result = await service.complete(baseExperiment.id);
        expect(data.finish.mock.invocationCallOrder[0]).toBeLessThan(data.saveOutcome.mock.invocationCallOrder[0]);
        expect(ai.generate).not.toHaveBeenCalled();
        expect(result.result).toBe("insufficient_data");
        expect(data.saveOutcome).toHaveBeenCalledWith(baseExperiment.id, expect.objectContaining({ analysisStatus: "not_needed", confidence: null }));
    });

    it("uses AI only to interpret deterministic supporting metrics", async () => {
        const data = repository(["easier", "easier", "same", "easier", "harder"]);
        const ai = { generate: vi.fn().mockResolvedValue({ content: '{"summary":"The observations lean in one direction.","interpretation":"The recorded experience may support the hypothesis, though other context could matter.","confidence":0.9,"result":"supports"}', provider: "fake", model: "fake", latencyMs: 2 }) };
        const result = await createExperimentService(data as never, ai).complete(baseExperiment.id);
        expect(result.result).toBe("supports");
        expect(data.saveOutcome).toHaveBeenCalledWith(baseExperiment.id, expect.objectContaining({ confidence: 0.7, metrics: { total: 5, easier: 3, same: 1, harder: 1 } }));
        expect(ai.generate).toHaveBeenCalledWith(expect.objectContaining({ task: "experiment_analysis", context: expect.objectContaining({ normalizedResult: "supports" }) }));
        expect(ai.generate.mock.calls[0][0].context.observations[0]).not.toHaveProperty("notes");
    });

    it("keeps completion and deterministic outcome when AI fails", async () => {
        const data = repository(["harder", "harder", "same"]);
        const service = createExperimentService(data as never, { generate: vi.fn().mockRejectedValue(new Error("provider unavailable")) });
        const result = await service.complete(baseExperiment.id);
        expect(result.result).toBe("does_not_support");
        expect(data.saveOutcome).toHaveBeenCalledWith(baseExperiment.id, expect.objectContaining({ analysisStatus: "failed", interpretation: null }));
        expect(data.updateRun).toHaveBeenCalledWith("run", expect.objectContaining({ status: "failed" }));
    });

    it("does not overwrite a concurrent analysis when the run is already in progress", async () => {
        const data = repository(["easier", "easier", "easier"]);
        data.claimAnalysis.mockRejectedValue(new Error("RATE_LIMITED"));
        const result = await createExperimentService(data as never, { generate: vi.fn() }).retryAnalysis(baseExperiment.id);
        expect(result.metadata.analysis_status).toBe("pending");
        expect(data.saveOutcome).toHaveBeenCalledTimes(1);
    });

    it("keeps a valid interpretation when run bookkeeping fails", async () => {
        const data = repository(["easier", "easier", "easier"]);
        data.updateRun.mockRejectedValue(new Error("telemetry failed"));
        const ai = { generate: vi.fn().mockResolvedValue({ content: '{"summary":"The observations lean in one direction.","interpretation":"The recorded experience may support the hypothesis, while other context could matter.","confidence":0.6,"result":"supports"}', provider: "fake", model: "fake", latencyMs: 2 }) };
        const result = await createExperimentService(data as never, ai).retryAnalysis(baseExperiment.id);
        expect(result.metadata.analysis_status).toBe("succeeded");
    });

    it("rejects unsafe or non-hypothesis setup text", async () => {
        const data = repository();
        const service = createExperimentService(data as never, { generate: vi.fn() });
        await expect(service.createDraft({ patternId: baseExperiment.patternId!, title: "Medication test", hypothesis: "Stopping medication may improve focus.", description: "Stop medication and compare the result.", durationDays: 5 })).rejects.toThrow("UNSAFE_EXPERIMENT");
        expect(data.createDraft).not.toHaveBeenCalled();
    });

    it("does not rerun a successful completion analysis", async () => {
        const data = repository(["easier", "easier", "easier"]);
        data.claimAnalysis.mockResolvedValue({ id: "run", status: "succeeded" });
        const ai = { generate: vi.fn() };
        await createExperimentService(data as never, ai).retryAnalysis(baseExperiment.id);
        expect(ai.generate).not.toHaveBeenCalled();
    });
});
