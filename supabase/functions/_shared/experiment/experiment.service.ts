import type { AIRequest, AIResult } from "../ai/types.ts";
import { experimentAnalysisTask } from "./experiment.analyzer.ts";
import type { ExperimentRepository } from "./experiment.repository.ts";
import type { ExperimentMetrics, ExperimentResult, StoredObservation } from "./experiment.types.ts";
import { validateExperimentAnalysis, validateExperimentSetup, validateObservation } from "./experiment.validation.ts";

export function calculateExperimentMetrics(observations: StoredObservation[]): ExperimentMetrics {
    return observations.reduce<ExperimentMetrics>((metrics, observation) => {
        metrics.total += 1;
        const result = observation.value.result;
        if (result === "easier" || result === "same" || result === "harder") metrics[result] += 1;
        return metrics;
    }, { total: 0, easier: 0, same: 0, harder: 0 });
}

export function determineExperimentResult(metrics: ExperimentMetrics): ExperimentResult {
    if (metrics.total < 3) return "insufficient_data";
    if (metrics.easier > metrics.harder && metrics.easier / metrics.total >= 0.6) return "supports";
    if (metrics.harder > metrics.easier && metrics.harder / metrics.total >= 0.5) return "does_not_support";
    return "mixed";
}

function deterministicSummary(metrics: ExperimentMetrics, result: ExperimentResult) {
    if (result === "insufficient_data") return `There are ${metrics.total} recorded observations, which is not enough to draw a useful conclusion yet.`;
    if (result === "supports") return `Easier was recorded in ${metrics.easier} of ${metrics.total} observations. The observations support the hypothesis to some extent.`;
    if (result === "does_not_support") return `Harder was recorded in ${metrics.harder} of ${metrics.total} observations. The observations did not support the hypothesis.`;
    return `The ${metrics.total} observations were mixed: ${metrics.easier} easier, ${metrics.same} the same, and ${metrics.harder} harder.`;
}

function confidenceCap(total: number) {
    return total >= 10 ? 0.85 : total >= 7 ? 0.78 : total >= 5 ? 0.7 : 0.55;
}

export function createExperimentService(repository: ExperimentRepository, ai: { generate(request: AIRequest): Promise<AIResult> }) {
    const analyzeCompleted = async (experimentId: string) => {
        const experiment = await repository.getExperiment(experimentId);
        if (experiment.status !== "completed") throw new Error("EXPERIMENT_NOT_COMPLETED");
        const observations = await repository.listObservations(experimentId);
        const metrics = calculateExperimentMetrics(observations);
        const result = determineExperimentResult(metrics);
        const summary = deterministicSummary(metrics, result);
        if (result === "insufficient_data") return repository.saveOutcome(experimentId, { result, summary, confidence: null, metrics, interpretation: "There is not enough recorded evidence for a reliable interpretation.", analysisStatus: "not_needed" });

        const pending = await repository.saveOutcome(experimentId, { result, summary, confidence: null, metrics, interpretation: null, analysisStatus: "pending" });

        let runId: string | null = null;
        try {
            const claim = await repository.claimAnalysis(experimentId);
            if (claim.status === "succeeded") return repository.getExperiment(experimentId);
            runId = claim.id;
            const generated = await ai.generate({ ...experimentAnalysisTask, context: { experiment: { title: experiment.title, hypothesis: experiment.hypothesis, description: experiment.description, startDate: experiment.startDate, endDate: experiment.endDate }, metrics, normalizedResult: result, observations: observations.map((observation) => ({ value: observation.value, observedAt: observation.observedAt })) } });
            const analysis = validateExperimentAnalysis(generated.content, result);
            const saved = await repository.saveOutcome(experimentId, { result, summary, confidence: Math.min(analysis.confidence, confidenceCap(metrics.total)), metrics, interpretation: analysis.interpretation, analysisStatus: "succeeded" });
            await repository.updateRun(runId, { status: "succeeded", provider: generated.provider, model: generated.model, latency_ms: generated.latencyMs, input_tokens: generated.usage?.inputTokens ?? null, output_tokens: generated.usage?.outputTokens ?? null, error_code: null, completed_at: new Date().toISOString() }).catch(() => undefined);
            return saved;
        } catch (error) {
            if (!runId) return pending;
            if (runId) await repository.updateRun(runId, { status: "failed", error_code: error instanceof Error ? error.message.slice(0, 80) : "EXPERIMENT_ANALYSIS_FAILED", completed_at: new Date().toISOString() }).catch(() => undefined);
            return repository.saveOutcome(experimentId, { result, summary, confidence: null, metrics, interpretation: null, analysisStatus: "failed" });
        }
    };

    return {
        async createDraft(input: { patternId: string; title: unknown; hypothesis: unknown; description: unknown; durationDays: unknown }) {
            await repository.getPattern(input.patternId);
            const existing = await repository.findOpenForPattern(input.patternId);
            if (existing) return existing;
            return repository.createDraft({ patternId: input.patternId, ...validateExperimentSetup(input) });
        },
        start: (experimentId: string) => repository.start(experimentId),
        async recordObservation(input: { experimentId: string; value: unknown; notes?: unknown; requestId: string }) {
            if (!input.requestId || input.requestId.length > 100) throw new Error("INVALID_OBSERVATION");
            const observation = validateObservation(input.value, input.notes);
            return repository.record(input.experimentId, observation.value, observation.notes, input.requestId);
        },
        async complete(experimentId: string) {
            await repository.finish(experimentId);
            return analyzeCompleted(experimentId);
        },
        retryAnalysis: analyzeCompleted,
        cancel: (experimentId: string) => repository.cancel(experimentId),
        delete: (experimentId: string) => repository.delete(experimentId),
    };
}
