import type { AIRequest, AIResult } from "../ai/types.ts";
import { patternAnalysisTask } from "./pattern.analyzer.ts";
import type { PatternRepository } from "./pattern.repository.ts";
import type { ExistingPattern, PatternAction, PatternProposal, PatternRelationship, PatternSignal } from "./pattern.types.ts";
import { validatePatternAnalysis } from "./pattern.validation.ts";

function canonicalKey(relationship: PatternRelationship, conceptKeys: string[]) {
    const keys = relationship === "association" ? [...conceptKeys].sort() : conceptKeys;
    return `${relationship}|${keys.join("|")}`;
}

function conceptLabel(key: string) {
    const [type, rawValue = "{}"] = key.split(/:(.*)/s);
    let value: Record<string, unknown> = {};
    try { value = JSON.parse(rawValue); } catch {}
    switch (type) {
        case "difficulty_starting": return value.present === false ? "starting without reported difficulty" : "difficulty getting started";
        case "focus_difficulty": return value.present === false ? "focus without reported difficulty" : typeof value.period === "string" && value.period !== "unspecified" ? `focus difficulty in the ${value.period}` : "focus difficulty";
        case "energy_change": return `${value.direction ?? "changing"} energy`;
        case "sleep_quality": return `${value.quality ?? "changing"} sleep quality`;
        case "mood_state": return `${value.state ?? "changing"} mood`;
        case "stress_level": return `${value.level ?? "changing"} stress`;
        case "routine_change": return value.changed === false ? "a stable routine" : "routine changes";
        case "avoidance": return value.present === false ? "approaching tasks without reported avoidance" : "putting off tasks or situations";
        case "motivation_change": return `${value.direction ?? "changing"} motivation`;
        case "mood_observation": return typeof value.mood === "string" ? `a ${value.mood} check-in` : "your check-in";
        default: return type.replaceAll("_", " ");
    }
}

function displayPattern(relationship: PatternRelationship, conceptKeys: string[]) {
    const labels = conceptKeys.map(conceptLabel);
    if (relationship === "recurrence") return { title: `${capitalize(labels[0])} appears repeatedly`, description: "This observation has appeared across separate things you've shared. It may be useful to keep watching." };
    if (relationship === "sequence") return { title: `${capitalize(labels[1])} may follow ${labels[0]}`, description: "This sequence has appeared more than once. It suggests timing, not causation." };
    return { title: `${capitalize(labels[0])} and ${labels[1]} may appear together`, description: "These observations have appeared together more than once. This is an association, not proof that either causes the other." };
}

function capitalize(value: string) {
    return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function sourceCount(signals: PatternSignal[]) {
    return new Set(signals.map((signal) => signal.sourceKey)).size;
}

const relatedSignalTypes: Record<string, string[]> = {
    difficulty_starting: ["avoidance", "motivation_change", "stress_level"],
    focus_difficulty: ["energy_change", "sleep_quality", "stress_level", "routine_change"],
    energy_change: ["sleep_quality", "focus_difficulty", "mood_state"],
    sleep_quality: ["energy_change", "focus_difficulty", "mood_state", "stress_level"],
    mood_state: ["energy_change", "sleep_quality", "stress_level", "motivation_change"],
    stress_level: ["focus_difficulty", "sleep_quality", "avoidance", "mood_state"],
    routine_change: ["focus_difficulty", "energy_change", "motivation_change"],
    avoidance: ["difficulty_starting", "stress_level", "motivation_change"],
    mood_observation: ["sleep_quality", "energy_change", "stress_level", "focus_difficulty"],
    motivation_change: ["difficulty_starting", "energy_change", "mood_state", "avoidance"],
};

function validateRelationship(proposal: PatternProposal, selected: PatternSignal[]) {
    const expectedConceptCount = proposal.relationship === "recurrence" ? 1 : 2;
    if (proposal.conceptKeys.length !== expectedConceptCount || selected.some((signal) => !proposal.conceptKeys.includes(signal.conceptKey))) return null;
    if (proposal.relationship === "recurrence") {
        const matching = selected.filter((signal) => signal.conceptKey === proposal.conceptKeys[0]);
        const occurrences = sourceCount(matching);
        return occurrences >= 3 ? { signalIds: matching.map((signal) => signal.id), occurrences } : null;
    }
    if (proposal.relationship === "association") {
        const groups = new Map<string, Set<string>>();
        selected.forEach((signal) => {
            const concepts = groups.get(signal.sourceKey) ?? new Set<string>();
            concepts.add(signal.conceptKey);
            groups.set(signal.sourceKey, concepts);
        });
        const matchingSources = [...groups.entries()].filter(([, concepts]) => proposal.conceptKeys.every((key) => concepts.has(key))).map(([source]) => source);
        if (matchingSources.length < 2) return null;
        return { signalIds: selected.filter((signal) => matchingSources.includes(signal.sourceKey)).map((signal) => signal.id), occurrences: matchingSources.length };
    }

    const [first, second] = proposal.conceptKeys;
    const firstSignals = selected.filter((signal) => signal.conceptKey === first).sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    const secondSignals = selected.filter((signal) => signal.conceptKey === second).sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    const used = new Set<string>();
    let occurrences = 0;
    firstSignals.forEach((before) => {
        const after = secondSignals.find((candidate) => !used.has(candidate.id) && candidate.sourceKey !== before.sourceKey && Date.parse(candidate.observedAt) >= Date.parse(before.observedAt) && Date.parse(candidate.observedAt) - Date.parse(before.observedAt) <= 72 * 60 * 60 * 1000);
        if (after) { used.add(before.id); used.add(after.id); occurrences += 1; }
    });
    return occurrences >= 2 ? { signalIds: [...used], occurrences } : null;
}

export async function analyzePatterns(input: {
    repository: PatternRepository;
    ai: { generate(request: AIRequest): Promise<AIResult> };
    conversationId: string | null;
    userMessageId: string | null;
    reflectionId?: string | null;
    observedAt: string;
    currentSignals: Array<{ signalType: string }>;
}): Promise<PatternAction[]> {
    const signalTypes = [...new Set(input.currentSignals.map((signal) => signal.signalType))];
    if (!signalTypes.length) return [];
    const contextTypes = [...new Set(signalTypes.flatMap((type) => [type, ...(relatedSignalTypes[type] ?? [])]))];
    const [signals, currentSignalCounts] = await Promise.all([input.repository.getRecentSignals(contextTypes, input.observedAt), input.repository.countSignals(signalTypes, input.observedAt)]);
    const sources = sourceCount(signals.filter((signal) => signalTypes.includes(signal.signalType)));
    if (sources < 3 || !signalTypes.some((type) => (currentSignalCounts[type] ?? 0) >= 3 && (currentSignalCounts[type] ?? 0) % 3 === 0)) return [];

    const [existingPatterns, relevantMemories] = await Promise.all([input.repository.getExistingPatterns(), input.repository.getRelevantMemories()]);
    const claim = await input.repository.claimRun({ conversationId: input.conversationId, userMessageId: input.userMessageId, reflectionId: input.reflectionId ?? null });
    if (claim.status === "succeeded") return [];

    let result: AIResult;
    try {
        result = await input.ai.generate({ ...patternAnalysisTask, context: { newSignalTypes: signalTypes, signals, existingPatterns, relevantMemories } });
        const proposals = validatePatternAnalysis(result.content);
        const available = new Map(signals.map((signal) => [signal.id, signal]));
        const actions: PatternAction[] = [];
        for (const proposal of proposals) {
            if (proposal.signalIds.some((id) => !available.has(id)) || proposal.conceptKeys.some((key) => !signals.some((signal) => signal.conceptKey === key))) throw new Error("INVALID_PATTERN_EVIDENCE");
            const selected = proposal.signalIds.map((id) => available.get(id)!);
            const relationship = validateRelationship(proposal, selected);
            if (!relationship || relationship.signalIds.length < 3) continue;
            const key = canonicalKey(proposal.relationship, proposal.conceptKeys);
            const exact = existingPatterns.find((pattern) => pattern.canonicalKey === key);
            if (proposal.decision === "not_supported") continue;
            const target = exact;
            if (exact?.status === "testing") continue;

            const supportedThreshold = proposal.relationship === "recurrence" ? 6 : 5;
            const possibleThreshold = proposal.relationship === "recurrence" ? 5 : 3;
            const baseStatus = relationship.occurrences >= supportedThreshold && proposal.confidence >= 0.75 ? "supported" : relationship.occurrences >= possibleThreshold ? "possible" : "candidate";
            const statusRank = { candidate: 0, possible: 1, supported: 2, not_supported: -1 } as const;
            const status = exact && statusRank[exact.status] > statusRank[baseStatus] ? exact.status : baseStatus;
            const confidenceCap = status === "supported" ? 0.9 : status === "possible" ? 0.75 : status === "not_supported" ? 0.45 : 0.6;
            const presentation = displayPattern(proposal.relationship, proposal.conceptKeys);
            const confidence = Math.max(exact?.confidence ?? 0, Math.min(proposal.confidence, confidenceCap));
            const action = await input.repository.applyProposal({ runId: claim.id, targetPatternId: target?.id ?? null, proposal, title: presentation.title, description: presentation.description, canonicalKey: key, status, confidence, signalIds: relationship.signalIds, evidenceRelationship: "supporting", relationship: proposal.relationship, conceptKeys: proposal.conceptKeys, reason: "Based on repeated linked signal evidence." });
            if (action.action !== "no_action") actions.push(action);
        }
        await input.repository.updateRun(claim.id, successfulRun(result));
        return actions;
    } catch (error) {
        await input.repository.updateRun(claim.id, { status: "failed", error_code: error instanceof Error ? error.message.slice(0, 80) : "PATTERN_ANALYSIS_FAILED", completed_at: new Date().toISOString() }).catch(() => undefined);
        throw error;
    }
}

function successfulRun(result: AIResult) {
    return { status: "succeeded", provider: result.provider, model: result.model, latency_ms: result.latencyMs, input_tokens: result.usage?.inputTokens ?? null, output_tokens: result.usage?.outputTokens ?? null, error_code: null, completed_at: new Date().toISOString() };
}
