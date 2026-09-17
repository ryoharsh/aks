import type { ExperimentResult } from "../experiment/experiment.types.ts";
import type { LearningProposal } from "./learning.types.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const decisions = new Set(["create", "update", "reject", "insufficient_data"]);
const unsafe = /\b(always|never|proves?|guarantees?|causes?|cures?|treats?|diagnos(?:is|es|ed)|disorder|syndrome|mental illness|psychosis|schizophren(?:ia|ic)|ocd|adhd|depress(?:ion|ive)|bipolar|autis(?:m|tic)|ptsd|personality type)\b/i;
const cautious = /\b(may|might|appears?|seems?|suggests?|some|mixed|inconsistent|did not|didn't|not clearly)\b/i;

export function isSafeLearningText(value: string) {
    return !unsafe.test(value);
}

export function validateLearningSynthesis(content: string, sourceExperimentId: string, result: ExperimentResult): LearningProposal {
    let value: Record<string, unknown>;
    try { value = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); } catch { throw new Error("INVALID_LEARNING_SYNTHESIS"); }
    const learning = value.learning as Record<string, unknown> | undefined;
    if (typeof value.decision !== "string" || !decisions.has(value.decision)) throw new Error("INVALID_LEARNING_SYNTHESIS");
    if (!learning || typeof learning.key !== "string" || !/^[a-z0-9][a-z0-9_]{2,99}$/.test(learning.key)) throw new Error("INVALID_LEARNING_SYNTHESIS");
    if (typeof learning.title !== "string" || learning.title.trim().length < 5 || learning.title.length > 160 || unsafe.test(learning.title)) throw new Error("INVALID_LEARNING_SYNTHESIS");
    if (typeof learning.description !== "string" || learning.description.trim().length < 10 || learning.description.length > 1000 || unsafe.test(learning.description) || !cautious.test(learning.description) || /\d/.test(learning.description)) throw new Error("INVALID_LEARNING_SYNTHESIS");
    if (typeof value.confidence !== "number" || value.confidence < 0 || value.confidence > 1) throw new Error("INVALID_LEARNING_SYNTHESIS");
    if (value.sourceExperimentId !== sourceExperimentId) throw new Error("INVALID_LEARNING_SYNTHESIS");
    if (value.existingLearningId !== null && (typeof value.existingLearningId !== "string" || !uuidPattern.test(value.existingLearningId))) throw new Error("INVALID_LEARNING_SYNTHESIS");
    if (result === "insufficient_data" && value.decision !== "insufficient_data" && value.decision !== "reject") throw new Error("INVALID_LEARNING_SYNTHESIS");
    return { decision: value.decision as LearningProposal["decision"], learning: { key: learning.key, title: learning.title.trim(), description: learning.description.trim() }, confidence: value.confidence, sourceExperimentId, existingLearningId: value.existingLearningId as string | null };
}
