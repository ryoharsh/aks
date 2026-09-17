export type ExperimentStatus = "draft" | "active" | "completed" | "cancelled";
export type ExperimentResult = "supports" | "mixed" | "does_not_support" | "insufficient_data";

export type StoredExperiment = {
    id: string;
    patternId: string | null;
    title: string;
    hypothesis: string;
    description: string;
    status: ExperimentStatus;
    startDate: string | null;
    endDate: string | null;
    result: ExperimentResult | null;
    resultSummary: string | null;
    confidence: number | null;
    observationCount: number;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    learningStatus: "pending" | "succeeded" | "failed" | "not_applicable" | null;
    insightStatus: "pending" | "succeeded" | "failed" | "exhausted" | "not_applicable" | null;
};

export type StoredObservation = {
    id: string;
    experimentId: string;
    value: Record<string, unknown>;
    notes: string | null;
    observedAt: string;
    createdAt: string;
};

export type ExperimentMetrics = {
    total: number;
    easier: number;
    same: number;
    harder: number;
};

export type ExperimentAnalysis = {
    summary: string;
    interpretation: string;
    confidence: number;
    result: ExperimentResult;
};
