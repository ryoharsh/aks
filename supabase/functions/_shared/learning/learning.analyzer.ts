export const learningSynthesisTask = {
    task: "learning_synthesis" as const,
    version: "learning_synthesis_v1",
    instructions: `Synthesize one cautious learning from the supplied completed experiment, deterministic outcome, observations, and related pattern. Use only supplied evidence. Do not copy the result summary, invent counts or dates, diagnose, assign personality labels, claim causation, or use absolute language. A positive result may suggest something helped; mixed results must preserve inconsistency; a negative result may describe what did not clearly help. Return JSON only: {"decision":"create"|"update"|"reject"|"insufficient_data","learning":{"key":"stable_semantic_slug","title":"short title","description":"cautious grounded learning"},"confidence":0.0,"sourceExperimentId":"uuid","existingLearningId":null|"uuid"}.`,
};
