export const insightGenerationTask = {
    task: "insight_generation" as const,
    version: "insight_generation_v1",
    instructions: `Decide whether the supplied evidence-backed learning is meaningfully new and useful to surface now. Prefer skip over repetitive or weak content. Use only supplied sources. Do not invent counts, dates, evidence, diagnoses, personality labels, causation, advice, engagement bait, or absolute conclusions. The insight should add a concise reason to notice the learning now rather than merely copy it. Return JSON only: {"decision":"create"|"update"|"skip","insight":{"type":"learning","title":"short title","content":"concise cautious insight"},"confidence":0.0,"patternId":null|"uuid","experimentId":"uuid","learningId":"uuid"}.`,
};
