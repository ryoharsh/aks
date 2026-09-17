import type { MemoryEvaluation } from "./memory.types.ts";

const decisions = new Set(["candidate", "activate", "reject", "update"]);
const memoryTypes = new Set(["preference", "routine", "context", "goal", "recurring_experience", "self_reported_fact"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clinicalLanguage = /\b(diagnos(?:is|ed|tic)|disorder|syndrome|symptoms?|mental illness|clinical|psychosis|psychotic|schizophren(?:ia|ic)|obsessive[- ]compulsive|ocd|adhd|attention deficit|depress(?:ion|ive|ed)|anxiety disorder|bipolar|autis(?:m|tic)|ptsd|post-traumatic|phobia|eating disorder|addiction|attachment style|personality type)\b/i;
const traitAssertion = /\byou (?:are|seem|appear) (?:an? |emotionally |naturally |inherently )/i;

export function isSafeMemoryContent(content: string) {
    return /^(you|your)\b/i.test(content.trim()) && !clinicalLanguage.test(content) && !traitAssertion.test(content);
}

export function validateMemoryEvaluation(content: string): MemoryEvaluation {
    let value: Record<string, unknown>;
    try {
        value = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    } catch {
        throw new Error("INVALID_MEMORY_EVALUATION");
    }

    const memory = value.memory as Record<string, unknown> | undefined;
    const evidenceSignalIds = value.evidenceSignalIds;
    if (typeof value.decision !== "string" || !decisions.has(value.decision)) throw new Error("INVALID_MEMORY_EVALUATION");
    if (!memory || typeof memory.type !== "string" || !memoryTypes.has(memory.type)) throw new Error("INVALID_MEMORY_EVALUATION");
    if (typeof memory.content !== "string" || memory.content.trim().length < 10 || memory.content.length > 500) throw new Error("INVALID_MEMORY_EVALUATION");
    if (!isSafeMemoryContent(memory.content)) throw new Error("INVALID_MEMORY_EVALUATION");
    if (typeof value.confidence !== "number" || value.confidence < 0 || value.confidence > 1) throw new Error("INVALID_MEMORY_EVALUATION");
    if (typeof value.reason !== "string" || !value.reason.trim() || value.reason.length > 500) throw new Error("INVALID_MEMORY_EVALUATION");
    if (value.existingMemoryId !== null && (typeof value.existingMemoryId !== "string" || !uuidPattern.test(value.existingMemoryId))) throw new Error("INVALID_MEMORY_EVALUATION");
    if (!Array.isArray(evidenceSignalIds) || evidenceSignalIds.length < 2 || evidenceSignalIds.length > 6 || !evidenceSignalIds.every((id) => typeof id === "string" && uuidPattern.test(id))) throw new Error("INVALID_MEMORY_EVALUATION");

    return {
        decision: value.decision as MemoryEvaluation["decision"],
        memory: { type: memory.type, content: memory.content.trim() },
        confidence: value.confidence,
        reason: value.reason.trim(),
        existingMemoryId: value.existingMemoryId as string | null,
        evidenceSignalIds: [...new Set(evidenceSignalIds as string[])],
    };
}
