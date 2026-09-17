import type { AIRequest, AIResult } from "../ai/types.ts";
import { calculateExperimentMetrics, determineExperimentResult } from "../experiment/experiment.service.ts";
import type { StoredObservation } from "../experiment/experiment.types.ts";
import { learningSynthesisTask } from "./learning.analyzer.ts";
import type { LearningRepository } from "./learning.repository.ts";
import type { ExistingLearning, LearningAction } from "./learning.types.ts";
import { isSafeLearningText, validateLearningSynthesis } from "./learning.validation.ts";

function findDuplicate(learnings: ExistingLearning[], key: string) {
    return learnings.find((learning) => learning.canonicalKey === key) ?? null;
}

function evidenceCap(total: number) {
    return total >= 10 ? 0.85 : total >= 7 ? 0.78 : total >= 5 ? 0.7 : 0.55;
}

function groundedLearning(experiment: { title: string; hypothesis: string }, result: "supports" | "mixed" | "does_not_support", revised: boolean) {
    const title = (result === "supports" ? `${experiment.title}: evidence leaned supportive` : result === "mixed" ? `${experiment.title}: results varied` : `${experiment.title}: hypothesis not supported`).slice(0, 160);
    if (revised) return { title, description: `Across completed experiments, the effect appears inconsistent. The latest experiment ${result === "supports" ? "suggests the hypothesis may hold in this context" : result === "mixed" ? "produced mixed observations" : "did not clearly support the hypothesis"}: ${experiment.hypothesis}`.slice(0, 1000) };
    if (result === "supports") return { title, description: `This experiment suggests the hypothesis may hold in this context: ${experiment.hypothesis}`.slice(0, 1000) };
    if (result === "mixed") return { title, description: `This experiment suggests the hypothesis may help in some situations, but the recorded effect was inconsistent: ${experiment.hypothesis}`.slice(0, 1000) };
    return { title, description: `This experiment did not clearly support the hypothesis: ${experiment.hypothesis}`.slice(0, 1000) };
}

function deterministicKey(patternId: string | null, hypothesis: string, proposedKey: string) {
    if (patternId) return `pattern_${patternId.replaceAll("-", "")}_${proposedKey}`.slice(0, 300);
    return `hypothesis_${hypothesis.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 80)}`;
}

export function createLearningService(repository: LearningRepository, ai: { generate(request: AIRequest): Promise<AIResult> }) {
    return {
        async synthesize(experimentId: string): Promise<LearningAction> {
            const experiment = await repository.getExperiment(experimentId);
            if (experiment.status !== "completed" || !experiment.result) throw new Error("EXPERIMENT_NOT_COMPLETED");
            await repository.markExperiment(experimentId, "pending");
            let runId: string | null = null;
            let attemptToken: string | null = null;
            try {
              const observations = await repository.getObservations(experimentId);
              const normalizedObservations: StoredObservation[] = observations.flatMap((observation) => {
                const result = observation.value && typeof observation.value === "object" && !Array.isArray(observation.value) ? observation.value.result : null;
                return result === "easier" || result === "same" || result === "harder" ? [{ id: observation.id, experimentId, value: { result }, notes: observation.notes, observedAt: observation.observed_at, createdAt: observation.observed_at }] : [];
              });
              const metrics = calculateExperimentMetrics(normalizedObservations);
              const deterministicResult = determineExperimentResult(metrics);
              if (metrics.total < 3 || deterministicResult === "insufficient_data") {
                await repository.markExperiment(experimentId, "not_applicable");
                return { action: "no_action" };
              }
              if (experiment.result !== deterministicResult) throw new Error("EXPERIMENT_OUTCOME_MISMATCH");
              const existingForExperiment = await repository.findForExperiment(experimentId);
              if (existingForExperiment) {
                await repository.markExperiment(experimentId, "succeeded");
                return { action: "no_action", learningId: existingForExperiment };
              }
                const claim = await repository.claimRun(experimentId);
                if (claim.status === "succeeded") {
                    const learningId = await repository.findForExperiment(experimentId);
                    await repository.markExperiment(experimentId, learningId ? "succeeded" : "failed");
                    return learningId ? { action: "no_action", learningId } : { action: "no_action" };
                }
                runId = claim.id;
                attemptToken = claim.attemptToken;
                const [pattern, existingLearnings] = await Promise.all([repository.getPattern(experiment.pattern_id), repository.getExistingLearnings()]);
                const generated = await ai.generate({ ...learningSynthesisTask, context: { experiment: { id: experiment.id, title: experiment.title, hypothesis: experiment.hypothesis, description: experiment.description, startDate: experiment.start_date, endDate: experiment.end_date }, deterministicMetrics: metrics, deterministicResult, resultSummary: experiment.result_summary, experimentInterpretation: experiment.metadata?.interpretation ?? null, pattern, observations: normalizedObservations.map((observation) => ({ value: observation.value, observedAt: observation.observedAt })), existingLearnings } });
                const proposal = validateLearningSynthesis(generated.content, experimentId, deterministicResult);
                if (proposal.decision === "reject" || proposal.decision === "insufficient_data") {
                    await repository.updateRun(runId, successfulRun(generated), attemptToken);
                    await repository.markExperiment(experimentId, "not_applicable");
                    return { action: "no_action" };
                }
                proposal.learning.key = deterministicKey(experiment.pattern_id, experiment.hypothesis, proposal.learning.key);
                const duplicate = findDuplicate(existingLearnings, proposal.learning.key);
                const status = duplicate?.latestResult && duplicate.latestResult !== deterministicResult ? "revised" : duplicate?.status ?? "active";
                const relationship = deterministicResult === "supports" ? "supports" : deterministicResult === "mixed" ? "mixed" : "contradicts";
                const experimentConfidence = typeof experiment.confidence === "number" ? experiment.confidence : evidenceCap(metrics.total);
                proposal.learning = { ...proposal.learning, ...groundedLearning(experiment, deterministicResult, status === "revised") };
                if (!isSafeLearningText(`${proposal.learning.title} ${proposal.learning.description}`)) throw new Error("UNSAFE_LEARNING");
                const cumulativeEvidence = (duplicate?.evidenceCount ?? 0) + metrics.total;
                const action = await repository.apply({ runId, attemptToken: claim.attemptToken, targetLearningId: duplicate?.id ?? null, experimentId, proposal, status, confidence: Math.min(proposal.confidence, experimentConfidence, evidenceCap(cumulativeEvidence)), relationship });
                await repository.updateRun(runId, successfulRun(generated), attemptToken).catch(() => undefined);
                await repository.markExperiment(experimentId, "succeeded");
                return action;
            } catch (error) {
                if (error instanceof Error && error.message === "LEARNING_SYNTHESIS_SUPPRESSED") return { action: "no_action" };
                if (runId) await repository.updateRun(runId, { status: "failed", error_code: error instanceof Error ? error.message.slice(0, 80) : "LEARNING_SYNTHESIS_FAILED", completed_at: new Date().toISOString() }, attemptToken ?? undefined).catch(() => undefined);
                await repository.markExperiment(experimentId, "failed").catch(() => undefined);
                throw error;
            }
        },
    };
}

function successfulRun(result: AIResult) {
    return { status: "succeeded", provider: result.provider, model: result.model, latency_ms: result.latencyMs, input_tokens: result.usage?.inputTokens ?? null, output_tokens: result.usage?.outputTokens ?? null, error_code: null, completed_at: new Date().toISOString() };
}
