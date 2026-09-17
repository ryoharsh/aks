import { describe, expect, it, vi } from "vitest";

import { createInsightService } from "./insight.service.ts";
import { validateInsightGeneration } from "./insight.validation.ts";

const learningId = "60000000-0000-4000-8000-000000000001";
const experimentId = "50000000-0000-4000-8000-000000000001";
const patternId = "40000000-0000-4000-8000-000000000001";

const sources = {
    learning: { id: learningId, title: "Smaller starts may help", description: "This experiment suggests smaller starts may help in this context.", confidence: 0.68, evidence_count: 5, status: "active", updated_at: "2026-09-17T10:00:00Z", metadata: {} },
    experiment: { id: experimentId, pattern_id: patternId, title: "Small first step", result: "supports", result_summary: "Easier was recorded in four of five observations.", observation_count: 5, confidence: 0.7, completed_at: "2026-09-17T09:00:00Z" },
    pattern: { id: patternId, title: "Starting difficulty repeats", description: "This may be worth testing.", confidence: 0.65, status: "possible", updated_at: "2026-09-17T08:00:00Z" },
};

function repository() {
    return {
        getSources: vi.fn().mockResolvedValue(sources),
        getRecentInsights: vi.fn().mockResolvedValue([]),
        claimRun: vi.fn().mockResolvedValue({ id: "run", status: "started", attemptToken: "70000000-0000-4000-8000-000000000001" }),
        updateRun: vi.fn().mockResolvedValue(true),
        markExperiment: vi.fn().mockResolvedValue(undefined),
        apply: vi.fn().mockResolvedValue({ action: "created", insightId: "insight" }),
    };
}

function generation(overrides: Record<string, unknown> = {}) {
    return JSON.stringify({ decision: "create", insight: { type: "learning", title: "A change worth noticing", content: "Your recent experiment may have made smaller starts worth noticing." }, confidence: 0.7, patternId, experimentId, learningId, ...overrides });
}

describe("Insight Core", () => {
    it("skips when there is no meaningful source", async () => {
        const data = repository();
        data.getSources.mockResolvedValue(null);
        const ai = { generate: vi.fn() };
        await expect(createInsightService(data as never, ai).generate(experimentId)).resolves.toEqual({ action: "no_action" });
        expect(ai.generate).not.toHaveBeenCalled();
    });

    it("skips a weak learning", async () => {
        const data = repository();
        data.getSources.mockResolvedValue({ ...sources, learning: { ...sources.learning, confidence: 0.4 } });
        await createInsightService(data as never, { generate: vi.fn() }).generate(experimentId);
        expect(data.markExperiment).toHaveBeenCalledWith(experimentId, "not_applicable");
        expect(data.apply).not.toHaveBeenCalled();
    });

    it("creates an insight from a meaningful learning", async () => {
        const data = repository();
        const ai = { generate: vi.fn().mockResolvedValue({ content: generation(), provider: "fake", model: "fake", latencyMs: 2 }) };
        await expect(createInsightService(data as never, ai).generate(experimentId)).resolves.toEqual({ action: "created", insightId: "insight" });
        expect(data.apply).toHaveBeenCalledWith(expect.objectContaining({ sourceEvidenceCount: 5, proposal: expect.objectContaining({ learningId, experimentId, patternId, confidence: 0.65 }) }));
    });

    it("does not duplicate a current insight", async () => {
        const data = repository();
        data.getRecentInsights.mockResolvedValue([{ id: "insight", status: "seen", confidence: 0.6, metadata: {}, created_at: "2026-09-17T11:00:00Z" }]);
        const ai = { generate: vi.fn() };
        await expect(createInsightService(data as never, ai).generate(experimentId)).resolves.toEqual({ action: "skipped", insightId: "insight" });
        expect(ai.generate).not.toHaveBeenCalled();
    });

    it("does not resurface an unchanged dismissed insight", async () => {
        const data = repository();
        data.getRecentInsights.mockResolvedValue([{ id: "insight", status: "dismissed", confidence: 0.6, metadata: { source_updated_at: sources.learning.updated_at, source_evidence_count: 5 }, created_at: "2026-09-17T11:00:00Z" }]);
        await expect(createInsightService(data as never, { generate: vi.fn() }).generate(experimentId)).resolves.toEqual({ action: "skipped", insightId: "insight" });
        expect(data.apply).not.toHaveBeenCalled();
    });

    it("allows a revised learning to create a fresh insight", async () => {
        const data = repository();
        data.getSources.mockResolvedValue({ ...sources, learning: { ...sources.learning, status: "revised", updated_at: "2026-09-18T10:00:00Z" } });
        data.getRecentInsights.mockResolvedValue([{ id: "old", status: "archived", confidence: 0.6, metadata: { source_updated_at: "2026-09-17T10:00:00Z", source_evidence_count: 5 }, created_at: "2026-09-17T11:00:00Z" }]);
        const ai = { generate: vi.fn().mockResolvedValue({ content: generation(), provider: "fake", model: "fake", latencyMs: 2 }) };
        await createInsightService(data as never, ai).generate(experimentId);
        expect(data.apply).toHaveBeenCalled();
    });

    it("rejects malformed output, wrong sources, and invalid confidence", () => {
        expect(() => validateInsightGeneration("{}", { learningId, experimentId, patternId })).toThrow("INVALID_INSIGHT_GENERATION");
        expect(() => validateInsightGeneration(generation({ learningId: "60000000-0000-4000-8000-000000000099" }), { learningId, experimentId, patternId })).toThrow("INVALID_INSIGHT_GENERATION");
        expect(() => validateInsightGeneration(generation({ confidence: 2 }), { learningId, experimentId, patternId })).toThrow("INVALID_INSIGHT_GENERATION");
    });

    it("creates no fake insight when AI fails", async () => {
        const data = repository();
        await expect(createInsightService(data as never, { generate: vi.fn().mockRejectedValue(new Error("provider unavailable")) }).generate(experimentId)).rejects.toThrow("provider unavailable");
        expect(data.apply).not.toHaveBeenCalled();
        expect(data.markExperiment).toHaveBeenLastCalledWith(experimentId, "failed");
    });
});
