export const experimentAnalysisTask = {
    task: "experiment_analysis" as const,
    version: "experiment_analysis_v1",
    instructions: `Interpret only the supplied completed experiment and deterministic metrics. Do not invent observations, counts, dates, outcomes, causes, treatment advice, or permanent conclusions. The supplied normalized result is authoritative and your result must match it. Use calm, uncertain language. Return JSON only: {"summary":"brief non-numeric summary","interpretation":"brief uncertainty-aware interpretation","confidence":0.0,"result":"supports"|"mixed"|"does_not_support"|"insufficient_data"}.`,
};
