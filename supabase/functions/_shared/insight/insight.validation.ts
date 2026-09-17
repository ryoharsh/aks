import type { InsightProposal } from "./insight.types.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unsafe = /\b(always|never|proves?|guarantees?|causes?|cures?|treats?|diagnos(?:is|es|ed)|disorder|syndrome|mental illness|psychosis|schizophren(?:ia|ic)|ocd|adhd|depress(?:ion|ive)|bipolar|autis(?:m|tic)|ptsd|personality type|secret to|guess what)\b/i;
const groundedTone = /\b(may|might|appears?|seems?|suggests?|some|mixed|inconsistent|stood out|worth noticing|did not|didn't)\b/i;

export function isSafeInsightText(value: string) {
    return !unsafe.test(value);
}

export function validateInsightGeneration(content: string, sources: { patternId: string | null; experimentId: string; learningId: string }): InsightProposal {
    let value: Record<string, unknown>;
    try { value = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); } catch { throw new Error("INVALID_INSIGHT_GENERATION"); }
    const insight = value.insight as Record<string, unknown> | undefined;
    if (value.decision !== "create" && value.decision !== "update" && value.decision !== "skip") throw new Error("INVALID_INSIGHT_GENERATION");
    if (!insight || insight.type !== "learning") throw new Error("INVALID_INSIGHT_GENERATION");
    if (typeof insight.title !== "string" || insight.title.trim().length < 5 || insight.title.length > 160 || unsafe.test(insight.title) || /\d/.test(insight.title)) throw new Error("INVALID_INSIGHT_GENERATION");
    if (typeof insight.content !== "string" || insight.content.trim().length < 10 || insight.content.length > 1000 || unsafe.test(insight.content) || /\d/.test(insight.content) || !groundedTone.test(insight.content)) throw new Error("INVALID_INSIGHT_GENERATION");
    if (typeof value.confidence !== "number" || value.confidence < 0 || value.confidence > 1) throw new Error("INVALID_INSIGHT_GENERATION");
    if (value.learningId !== sources.learningId || value.experimentId !== sources.experimentId || value.patternId !== sources.patternId) throw new Error("INVALID_INSIGHT_GENERATION");
    if (!uuidPattern.test(value.learningId as string) || !uuidPattern.test(value.experimentId as string) || (value.patternId !== null && !uuidPattern.test(value.patternId as string))) throw new Error("INVALID_INSIGHT_GENERATION");
    return { decision: value.decision, insight: { type: "learning", title: insight.title.trim(), content: insight.content.trim() }, confidence: value.confidence, patternId: sources.patternId, experimentId: sources.experimentId, learningId: sources.learningId };
}
