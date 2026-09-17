export const patternAnalysisTask = {
    task: "pattern_analysis" as const,
    version: "pattern_analysis_v1",
    instructions: `Identify at most two conservative relationships supported by the supplied signals. A recurrence repeats one exact concept. An association requires two exact concepts repeatedly appearing in the same source. A sequence requires one exact concept repeatedly preceding another. Use only supplied concept keys and signal IDs. Never infer causation, hidden traits, diagnoses, or personality labels. Prefer no candidate over weak speculation. Existing memories are context only, never evidence. Return JSON only: {"candidates":[{"decision":"create"|"update"|"not_supported","title":"...","description":"uncertain non-causal wording","relationship":"recurrence"|"association"|"sequence","conceptKeys":["..."],"confidence":0.0,"signalIds":["uuid"],"existingPatternId":null|"uuid","alternativeExplanation":null|"..."}]}.`,
};
