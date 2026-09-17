export type LearningStatus = "active" | "revised" | "archived";

export type ExistingLearning = {
    id: string;
    title: string;
    description: string;
    canonicalKey: string;
    confidence: number | null;
    status: "active" | "revised";
    latestResult: "supports" | "mixed" | "does_not_support" | null;
    evidenceCount: number;
    resultCounts: { supports: number; mixed: number; doesNotSupport: number };
};

export type LearningProposal = {
    decision: "create" | "update" | "reject" | "insufficient_data";
    learning: { key: string; title: string; description: string };
    confidence: number;
    sourceExperimentId: string;
    existingLearningId: string | null;
};

export type LearningAction = { action: "created" | "updated" | "no_action"; learningId?: string; status?: LearningStatus };
