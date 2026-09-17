import type { AIRequest, AIResult } from "../ai/types.ts";
import { memoryEvaluationTask } from "./memory.evaluator.ts";
import type { MemoryRepository } from "./memory.repository.ts";
import type { ExistingMemory, MemoryAction, MemorySignalEvidence } from "./memory.types.ts";
import { validateMemoryEvaluation } from "./memory.validation.ts";

function normalized(content: string) {
    return content.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function canonicalMemory(item: MemorySignalEvidence) {
    const value = item.value && typeof item.value === "object" && !Array.isArray(item.value) ? item.value as Record<string, unknown> : {};
    switch (item.signalType) {
        case "difficulty_starting": return value.present === true ? { key: "difficulty_starting:true", type: "recurring_experience", content: "You may often find it difficult to get started on some tasks." } : null;
        case "focus_difficulty": return value.present === true ? { key: `focus_difficulty:true:${typeof value.period === "string" ? value.period : "unspecified"}`, type: "recurring_experience", content: typeof value.period === "string" && value.period !== "unspecified" ? `You may often find it harder to focus in the ${value.period}.` : "You may often find it difficult to focus." } : null;
        case "energy_change": return value.direction === "higher" ? { key: "energy:higher", type: "recurring_experience", content: "You often report periods of higher energy." } : value.direction === "lower" ? { key: "energy:lower", type: "recurring_experience", content: "You often report periods of lower energy." } : value.direction === "variable" ? { key: "energy:variable", type: "recurring_experience", content: "You often report that your energy varies." } : null;
        case "sleep_quality": return value.quality === "better" ? { key: "sleep:better", type: "recurring_experience", content: "You often report better sleep." } : value.quality === "worse" ? { key: "sleep:worse", type: "recurring_experience", content: "You often report disrupted or lower-quality sleep." } : value.quality === "mixed" ? { key: "sleep:mixed", type: "recurring_experience", content: "You often report mixed sleep quality." } : null;
        case "mood_state": return value.state === "positive" ? { key: "mood:positive", type: "recurring_experience", content: "You often report positive moods." } : value.state === "low" ? { key: "mood:low", type: "recurring_experience", content: "You often report lower moods." } : value.state === "neutral" ? { key: "mood:neutral", type: "recurring_experience", content: "You often describe your mood as neutral." } : value.state === "mixed" ? { key: "mood:mixed", type: "recurring_experience", content: "You often report mixed moods." } : null;
        case "stress_level": return typeof value.level === "string" ? { key: `stress:${value.level}`, type: "recurring_experience", content: `You often report ${value.level === "high" ? "higher" : value.level === "low" ? "lower" : "moderate"} stress.` } : null;
        case "routine_change": return value.changed === true ? { key: "routine:true", type: "routine", content: "You often report changes to your routine." } : value.changed === false ? { key: "routine:false", type: "routine", content: "You often report that your routine stays consistent." } : null;
        case "avoidance": return value.present === true ? { key: "avoidance:true", type: "recurring_experience", content: "You may often put off some tasks or situations." } : null;
        case "motivation_change": return value.direction === "higher" ? { key: "motivation:higher", type: "recurring_experience", content: "You often report periods of higher motivation." } : value.direction === "lower" ? { key: "motivation:lower", type: "recurring_experience", content: "You often report periods of lower motivation." } : value.direction === "variable" ? { key: "motivation:variable", type: "recurring_experience", content: "You often report that your motivation varies." } : null;
        default: return null;
    }
}

function selectGroundedEvidence(evidence: MemorySignalEvidence[]) {
    const groups = new Map<string, { memory: NonNullable<ReturnType<typeof canonicalMemory>>; evidence: MemorySignalEvidence[] }>();
    evidence.forEach((item) => {
        const memory = canonicalMemory(item);
        if (!memory) return;
        const group = groups.get(memory.key) ?? { memory, evidence: [] };
        group.evidence.push(item);
        groups.set(memory.key, group);
    });
    return [...groups.values()].sort((a, b) => b.evidence.length - a.evidence.length)[0] ?? null;
}

function findDuplicate(memories: ExistingMemory[], canonicalKey: string, requestedId: string | null, decision: string) {
    const requested = requestedId && (decision === "update" || decision === "reject")
        ? memories.find((memory) => memory.id === requestedId && memory.canonicalKey === canonicalKey)
        : undefined;
    if (requested) return requested;
    return memories.find((memory) => memory.canonicalKey === canonicalKey) ?? null;
}

export async function evaluateMemory(input: {
    repository: MemoryRepository;
    ai: { generate(request: AIRequest): Promise<AIResult> };
    conversationId: string;
    userMessageId: string;
    observedAt: string;
    currentSignals: Array<{ signalType: string }>;
}): Promise<MemoryAction> {
    const signalTypes = [...new Set(input.currentSignals.map((signal) => signal.signalType))];
    const evidence = await input.repository.getSupportingSignals(signalTypes, input.observedAt);
    const distinctSources = new Set(evidence.map((item) => item.sourceMessageId ?? item.id));
    if (evidence.length < 2 || distinctSources.size < 2) return { action: "no_action" };

    const existingMemories = await input.repository.getExistingMemories();
    const claim = await input.repository.claimRun({ conversationId: input.conversationId, userMessageId: input.userMessageId });
    if (claim.status === "succeeded") return { action: "no_action" };

    let result: AIResult;
    try {
        result = await input.ai.generate({
            ...memoryEvaluationTask,
            context: {
                candidate: { signalTypes },
                evidence: evidence.map((item) => ({ id: item.id, signalType: item.signalType, value: item.value, confidence: item.confidence, observedAt: item.observedAt, sourceExcerpt: item.sourceExcerpt })),
                existingMemories,
            },
        });
        const evaluation = validateMemoryEvaluation(result.content);
        const allowedIds = new Set(evidence.map((item) => item.id));
        const selectedEvidence = evaluation.evidenceSignalIds.filter((id) => allowedIds.has(id));
        const selected = evidence.filter((item) => selectedEvidence.includes(item.id));
        const grounded = selectGroundedEvidence(selected);
        const groundedEvidence = grounded?.evidence ?? [];
        const groundedEvidenceIds = groundedEvidence.map((item) => item.id);
        const selectedSources = new Set(groundedEvidence.map((item) => item.sourceMessageId ?? item.id));
        if (!grounded || groundedEvidenceIds.length < 2 || selectedSources.size < 2) {
            await input.repository.updateRun(claim.id, successfulRun(result));
            return { action: "no_action" };
        }
        evaluation.memory = { type: grounded.memory.type, content: grounded.memory.content };

        const duplicate = findDuplicate(existingMemories, grounded.memory.key, evaluation.existingMemoryId, evaluation.decision);
        if (evaluation.decision === "reject" && !duplicate) {
            await input.repository.updateRun(claim.id, successfulRun(result));
            return { action: "no_action" };
        }
        let status: "candidate" | "active" | "rejected" = evaluation.decision === "reject" ? "rejected" : "candidate";
        if (evaluation.decision === "activate" && groundedEvidenceIds.length >= 3 && selectedSources.size >= 3) status = "active";
        if (duplicate?.status === "active" && evaluation.decision !== "reject") status = "active";
        if (evaluation.decision === "reject" && duplicate) {
            status = "candidate";
            evaluation.memory.content = duplicate.content;
            evaluation.memory.type = duplicate.memoryType;
        }

        const confidenceCap = groundedEvidenceIds.length >= 5 ? 0.9 : groundedEvidenceIds.length >= 3 ? 0.8 : 0.65;
        evaluation.reason = `Supported by ${groundedEvidenceIds.length} repeated ${groundedEvidenceIds.length === 1 ? "observation" : "observations"}.`;
        const applied = await input.repository.applyEvaluation({
            runId: claim.id,
            targetMemoryId: duplicate?.id ?? null,
            evaluation,
            status,
            confidence: evaluation.decision === "reject" ? Math.min(evaluation.confidence, confidenceCap) : Math.max(duplicate?.confidence ?? 0, Math.min(evaluation.confidence, confidenceCap)),
            evidenceSignalIds: groundedEvidenceIds,
            normalizedContent: normalized(evaluation.memory.content),
            canonicalKey: grounded.memory.key,
            version: memoryEvaluationTask.version,
        });
        await input.repository.updateRun(claim.id, successfulRun(result));
        return applied;
    } catch (error) {
        await input.repository.updateRun(claim.id, { status: "failed", error_code: error instanceof Error ? error.message.slice(0, 80) : "MEMORY_EVALUATION_FAILED", completed_at: new Date().toISOString() }).catch(() => undefined);
        throw error;
    }
}

function successfulRun(result: AIResult) {
    return { status: "succeeded", provider: result.provider, model: result.model, latency_ms: result.latencyMs, input_tokens: result.usage?.inputTokens ?? null, output_tokens: result.usage?.outputTokens ?? null, error_code: null, completed_at: new Date().toISOString() };
}
