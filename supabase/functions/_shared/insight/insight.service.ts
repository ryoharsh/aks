import type { AIRequest, AIResult } from "../ai/types.ts";
import { insightGenerationTask } from "./insight.analyzer.ts";
import type { InsightRepository } from "./insight.repository.ts";
import type { InsightAction } from "./insight.types.ts";
import { isSafeInsightText, validateInsightGeneration } from "./insight.validation.ts";

function groundedInsight(result: string, revised: boolean) {
    if (revised) return { title: "A learning has shifted", content: "Your recent experiment changed how this learning looks. The mixed direction may be worth noticing without treating it as a final conclusion." };
    if (result === "supports") return { title: "An experiment result stood out", content: "Your recent experiment added support to an idea you tested. It may be worth noticing in similar situations." };
    if (result === "does_not_support") return { title: "A different result stood out", content: "Your recent experiment did not support the idea as expected. That result may be useful to keep in mind." };
    return { title: "The result was mixed", content: "Your recent experiment pointed in more than one direction. The context may matter more than a single conclusion." };
}

export function createInsightService(repository: InsightRepository, ai: { generate(request: AIRequest): Promise<AIResult> }) {
    return {
        async generate(experimentId: string): Promise<InsightAction> {
            const sources = await repository.getSources(experimentId);
            if (!sources || (sources.learning.status !== "active" && sources.learning.status !== "revised") || sources.learning.evidence_count < 3 || typeof sources.learning.confidence !== "number" || sources.learning.confidence < 0.5) {
                await repository.markExperiment(experimentId, "not_applicable");
                return { action: "no_action" };
            }
            const previous = await repository.getRecentInsights(sources.learning.id);
            const current = previous.find((insight) => insight.status === "new" || insight.status === "seen");
            if (current) {
                await repository.markExperiment(experimentId, "succeeded");
                return { action: "skipped", insightId: current.id };
            }
            const latest = previous[0];
            const metadata = latest?.metadata && typeof latest.metadata === "object" && !Array.isArray(latest.metadata) ? latest.metadata : {};
            const previousEvidenceCount = typeof metadata.source_evidence_count === "number" ? metadata.source_evidence_count : 0;
            const sourceUnchanged = metadata.source_updated_at === sources.learning.updated_at;
            if (latest && (sourceUnchanged || (sources.learning.status !== "revised" && sources.learning.evidence_count - previousEvidenceCount < 3))) {
                await repository.markExperiment(experimentId, "not_applicable");
                return { action: "skipped", insightId: latest.id };
            }

            await repository.markExperiment(experimentId, "pending");
            let runId: string | null = null;
            let attemptToken: string | null = null;
            try {
                const claim = await repository.claimRun(experimentId);
                if (claim.status === "succeeded") {
                    await repository.markExperiment(experimentId, "succeeded");
                    return { action: "no_action" };
                }
                runId = claim.id;
                attemptToken = claim.attemptToken;
                const generated = await ai.generate({ ...insightGenerationTask, context: { learning: sources.learning, experiment: sources.experiment, pattern: sources.pattern, previousRelatedInsights: previous } });
                const proposal = validateInsightGeneration(generated.content, { learningId: sources.learning.id, experimentId: sources.experiment.id, patternId: sources.pattern?.id ?? null });
                if (proposal.decision === "skip") {
                    const updated = await repository.updateRun(runId, successfulRun(generated), attemptToken);
                    if (!updated) return { action: "no_action" };
                    await repository.markExperiment(experimentId, "not_applicable");
                    return { action: "no_action" };
                }
                proposal.insight = { type: "learning", ...groundedInsight(sources.experiment.result, sources.learning.status === "revised") };
                if (!isSafeInsightText(`${proposal.insight.title} ${proposal.insight.content}`)) throw new Error("UNSAFE_INSIGHT");
                proposal.confidence = Math.min(proposal.confidence, sources.learning.confidence, typeof sources.experiment.confidence === "number" ? sources.experiment.confidence : sources.learning.confidence, typeof sources.pattern?.confidence === "number" ? sources.pattern.confidence : sources.learning.confidence);
                const action = await repository.apply({ runId, attemptToken, proposal, sourceUpdatedAt: sources.learning.updated_at, sourceEvidenceCount: sources.learning.evidence_count, sourceExperimentResult: sources.experiment.result, sourceExperimentObservationCount: sources.experiment.observation_count, sourcePatternUpdatedAt: sources.pattern?.updated_at ?? null });
                await repository.updateRun(runId, successfulRun(generated), attemptToken).catch(() => undefined);
                await repository.markExperiment(experimentId, "succeeded");
                return action;
            } catch (error) {
                if (error instanceof Error && error.message === "INSIGHT_GENERATION_SUPPRESSED") return { action: "no_action" };
                if (error instanceof Error && error.message === "ATTEMPTS_EXHAUSTED") {
                    await repository.markExperiment(experimentId, "exhausted").catch(() => undefined);
                    return { action: "no_action" };
                }
                if (runId && attemptToken) {
                    const updated = await repository.updateRun(runId, { status: "failed", error_code: error instanceof Error ? error.message.slice(0, 80) : "INSIGHT_GENERATION_FAILED", completed_at: new Date().toISOString() }, attemptToken).catch(() => false);
                    if (!updated) return { action: "no_action" };
                }
                await repository.markExperiment(experimentId, "failed").catch(() => undefined);
                throw error;
            }
        },
    };
}

function successfulRun(result: AIResult) {
    return { status: "succeeded", provider: result.provider, model: result.model, latency_ms: result.latencyMs, input_tokens: result.usage?.inputTokens ?? null, output_tokens: result.usage?.outputTokens ?? null, error_code: null, completed_at: new Date().toISOString() };
}
