import type { ExperimentAnalysis, ExperimentResult } from "./experiment.types.ts";

const results = new Set<ExperimentResult>(["supports", "mixed", "does_not_support", "insufficient_data"]);
const unsafeExperiment = /\b(stop|skip|change|reduce|increase)\s+(?:your\s+)?(?:medication|medicine|prescription)|\b(fast(?:ing)?|sleep deprivation|deprive yourself|extreme exercise|self-harm|dangerous|medical treatment|diagnos(?:is|e))\b/i;
const unsafeAnalysis = /\b(proves?|guarantees?|causes?|cures?|treats?|diagnos(?:is|es|ed)|disorder|syndrome)\b/i;
const numbersOrDates = /\d|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|june|july|august|september|october|november|december)\b/i;

export function validateExperimentSetup(input: { title: unknown; hypothesis: unknown; description: unknown; durationDays: unknown }) {
    if (typeof input.title !== "string" || input.title.trim().length < 3 || input.title.length > 120) throw new Error("INVALID_EXPERIMENT");
    if (typeof input.hypothesis !== "string" || input.hypothesis.trim().length < 10 || input.hypothesis.length > 500 || !/\b(may|might|could|appears?)\b/i.test(input.hypothesis)) throw new Error("INVALID_EXPERIMENT");
    if (typeof input.description !== "string" || input.description.trim().length < 10 || input.description.length > 1000) throw new Error("INVALID_EXPERIMENT");
    if (unsafeExperiment.test(`${input.title} ${input.hypothesis} ${input.description}`)) throw new Error("UNSAFE_EXPERIMENT");
    if (![3, 5, 7, 14].includes(Number(input.durationDays))) throw new Error("INVALID_EXPERIMENT");
    return { title: input.title.trim(), hypothesis: input.hypothesis.trim(), description: input.description.trim(), durationDays: Number(input.durationDays) };
}

export function validateObservation(value: unknown, notes: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_OBSERVATION");
    const result = (value as Record<string, unknown>).result;
    if (result !== "easier" && result !== "same" && result !== "harder") throw new Error("INVALID_OBSERVATION");
    if (notes !== null && notes !== undefined && (typeof notes !== "string" || notes.length > 2000)) throw new Error("INVALID_OBSERVATION");
    return { value: { result }, notes: typeof notes === "string" && notes.trim() ? notes.trim() : null };
}

export function validateExperimentAnalysis(content: string, expectedResult: ExperimentResult): ExperimentAnalysis {
    let value: Record<string, unknown>;
    try { value = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); } catch { throw new Error("INVALID_EXPERIMENT_ANALYSIS"); }
    if (typeof value.summary !== "string" || !value.summary.trim() || value.summary.length > 1000 || unsafeAnalysis.test(value.summary) || numbersOrDates.test(value.summary)) throw new Error("INVALID_EXPERIMENT_ANALYSIS");
    if (typeof value.interpretation !== "string" || !value.interpretation.trim() || value.interpretation.length > 1500 || unsafeAnalysis.test(value.interpretation) || numbersOrDates.test(value.interpretation)) throw new Error("INVALID_EXPERIMENT_ANALYSIS");
    if (typeof value.confidence !== "number" || value.confidence < 0 || value.confidence > 1) throw new Error("INVALID_EXPERIMENT_ANALYSIS");
    if (typeof value.result !== "string" || !results.has(value.result as ExperimentResult) || value.result !== expectedResult) throw new Error("INVALID_EXPERIMENT_ANALYSIS");
    return { summary: value.summary.trim(), interpretation: value.interpretation.trim(), confidence: value.confidence, result: value.result as ExperimentResult };
}
