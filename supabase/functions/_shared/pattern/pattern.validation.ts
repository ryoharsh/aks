import type { PatternProposal, PatternRelationship } from "./pattern.types.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const decisions = new Set(["create", "update", "not_supported"]);
const relationships = new Set<PatternRelationship>(["recurrence", "association", "sequence"]);
const unsafeLanguage = /\b(causes?|caused|proves?|guarantees?|diagnos(?:is|ed|tic)|disorder|syndrome|mental illness|psychosis|schizophren(?:ia|ic)|ocd|adhd|depress(?:ion|ive)|bipolar|autis(?:m|tic)|ptsd|personality type)\b/i;
const uncertainLanguage = /\b(may|might|appears?|seems?|possible|associated|often|tends?)\b/i;

export function validatePatternAnalysis(content: string): PatternProposal[] {
    let value: Record<string, unknown>;
    try {
        value = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    } catch {
        throw new Error("INVALID_PATTERN_ANALYSIS");
    }
    if (!Array.isArray(value.candidates)) throw new Error("INVALID_PATTERN_ANALYSIS");
    return value.candidates.slice(0, 2).map((raw) => {
        if (!raw || typeof raw !== "object") throw new Error("INVALID_PATTERN_ANALYSIS");
        const candidate = raw as Record<string, unknown>;
        if (typeof candidate.decision !== "string" || !decisions.has(candidate.decision)) throw new Error("INVALID_PATTERN_ANALYSIS");
        if (typeof candidate.relationship !== "string" || !relationships.has(candidate.relationship as PatternRelationship)) throw new Error("INVALID_PATTERN_ANALYSIS");
        if (typeof candidate.title !== "string" || candidate.title.trim().length < 5 || candidate.title.length > 200 || unsafeLanguage.test(candidate.title)) throw new Error("INVALID_PATTERN_ANALYSIS");
        if (typeof candidate.description !== "string" || candidate.description.trim().length < 10 || candidate.description.length > 1000 || unsafeLanguage.test(candidate.description) || !uncertainLanguage.test(candidate.description)) throw new Error("INVALID_PATTERN_ANALYSIS");
        if (typeof candidate.confidence !== "number" || candidate.confidence < 0 || candidate.confidence > 1) throw new Error("INVALID_PATTERN_ANALYSIS");
        if (!Array.isArray(candidate.conceptKeys) || candidate.conceptKeys.length < 1 || candidate.conceptKeys.length > 2 || !candidate.conceptKeys.every((key) => typeof key === "string" && key.length <= 300)) throw new Error("INVALID_PATTERN_ANALYSIS");
        if (!Array.isArray(candidate.signalIds) || candidate.signalIds.length < 3 || candidate.signalIds.length > 12 || !candidate.signalIds.every((id) => typeof id === "string" && uuidPattern.test(id))) throw new Error("INVALID_PATTERN_ANALYSIS");
        if (candidate.existingPatternId !== null && (typeof candidate.existingPatternId !== "string" || !uuidPattern.test(candidate.existingPatternId))) throw new Error("INVALID_PATTERN_ANALYSIS");
        if (candidate.alternativeExplanation !== null && (typeof candidate.alternativeExplanation !== "string" || candidate.alternativeExplanation.length > 500 || unsafeLanguage.test(candidate.alternativeExplanation))) throw new Error("INVALID_PATTERN_ANALYSIS");
        return { decision: candidate.decision, title: candidate.title.trim(), description: candidate.description.trim(), relationship: candidate.relationship, conceptKeys: [...new Set(candidate.conceptKeys as string[])], confidence: candidate.confidence, signalIds: [...new Set(candidate.signalIds as string[])], existingPatternId: candidate.existingPatternId, alternativeExplanation: candidate.alternativeExplanation?.trim() || null } as PatternProposal;
    });
}
