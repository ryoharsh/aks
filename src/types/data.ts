import type { Database, Json } from "./database";

export type MessageRole = Database["public"]["Enums"]["message_role"];
export type SignalSourceType = Database["public"]["Enums"]["signal_source_type"];

export type PageOptions = {
    page?: number;
    pageSize?: number;
};

export type Page<T> = {
    items: T[];
    hasMore: boolean;
};

export type Conversation = {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    archivedAt: string | null;
};

export type Message = {
    id: string;
    conversationId: string;
    role: MessageRole;
    content: string;
    replyToMessageId: string | null;
    metadata: Json;
    createdAt: string;
};

export type Reflection = {
    id: string;
    content: string;
    metadata: Json;
    createdAt: string;
};

export type CheckIn = {
    id: string;
    mood: string | null;
    energy: number | null;
    focus: number | null;
    stress: number | null;
    notes: string | null;
    metadata: Json;
    createdAt: string;
};

export type Signal = {
    id: string;
    sourceType: SignalSourceType;
    sourceId: string;
    sourceMessageId: string | null;
    signalType: string;
    value: Json;
    confidence: number | null;
    observedAt: string;
    createdAt: string;
};

export type MemoryStatus = "candidate" | "active" | "rejected" | "archived";

export type Memory = {
    id: string;
    memoryType: string;
    content: string;
    status: MemoryStatus;
    confidence: number | null;
    evidenceCount: number;
    firstObservedAt: string;
    lastObservedAt: string;
    metadata: Json;
    createdAt: string;
    updatedAt: string;
};

export type MemoryEvidence = {
    id: string;
    memoryId: string;
    signalId: string | null;
    messageId: string | null;
    reflectionId: string | null;
    checkInId: string | null;
    observedAt: string;
    createdAt: string;
    sourceType: "conversation" | "reflection" | "check_in" | "experiment" | "message" | "unknown";
    sourceId: string | null;
    signalType: string | null;
    sourceExcerpt: string | null;
};

export type PatternStatus = "candidate" | "possible" | "testing" | "supported" | "not_supported" | "archived";

export type Pattern = {
    id: string;
    title: string;
    description: string;
    status: PatternStatus;
    confidence: number | null;
    evidenceCount: number;
    firstDetectedAt: string;
    lastObservedAt: string;
    metadata: Json;
    createdAt: string;
    updatedAt: string;
};

export type PatternEvidence = {
    id: string;
    patternId: string;
    signalId: string;
    relationship: "supporting" | "contradicting";
    observedAt: string;
    createdAt: string;
    signalType: string;
    sourceType: SignalSourceType;
    sourceId: string;
    sourceExcerpt: string | null;
};

export type ExperimentStatus = "draft" | "active" | "completed" | "cancelled";
export type ExperimentResult = "supports" | "mixed" | "does_not_support" | "insufficient_data";

export type Experiment = {
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
    metadata: Json;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    learningStatus: "pending" | "succeeded" | "failed" | "not_applicable" | null;
    insightStatus: "pending" | "succeeded" | "failed" | "exhausted" | "not_applicable" | null;
};

export type ExperimentObservation = {
    id: string;
    experimentId: string;
    value: Json;
    notes: string | null;
    observedAt: string;
    createdAt: string;
};

export type LearningStatus = "active" | "revised" | "archived";

export type Learning = {
    id: string;
    title: string;
    description: string;
    confidence: number | null;
    evidenceCount: number;
    sourceExperimentId: string | null;
    status: LearningStatus;
    metadata: Json;
    createdAt: string;
    updatedAt: string;
};

export type LearningEvidence = {
    id: string;
    learningId: string;
    experimentId: string;
    relationship: "supports" | "mixed" | "contradicts";
    observedAt: string;
    createdAt: string;
    experimentTitle: string;
    result: ExperimentResult;
    resultSummary: string;
    observationCount: number;
};

export type InsightStatus = "new" | "seen" | "dismissed" | "archived";

export type Insight = {
    id: string;
    type: string;
    title: string;
    content: string;
    patternId: string | null;
    experimentId: string | null;
    learningId: string | null;
    confidence: number | null;
    status: InsightStatus;
    seenAt: string | null;
    metadata: Json;
    createdAt: string;
    updatedAt: string;
};

export type YourDataCounts = {
    conversations: number;
    reflections: number;
    checkIns: number;
    memories: number;
    patterns: number;
    experiments: number;
    learnings: number;
    insights: number;
};
