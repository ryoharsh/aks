export type MemoryStatus = "candidate" | "active" | "rejected" | "archived";

export type MemorySignalEvidence = {
    id: string;
    signalType: string;
    value: unknown;
    confidence: number | null;
    observedAt: string;
    sourceMessageId: string | null;
    sourceExcerpt: string | null;
};

export type ExistingMemory = {
    id: string;
    memoryType: string;
    content: string;
    status: "candidate" | "active";
    confidence: number | null;
    evidenceCount: number;
    lastObservedAt: string;
    canonicalKey: string | null;
};

export type MemoryEvaluation = {
    decision: "candidate" | "activate" | "reject" | "update";
    memory: { type: string; content: string };
    confidence: number;
    reason: string;
    existingMemoryId: string | null;
    evidenceSignalIds: string[];
};

export type MemoryAction = {
    action: "created" | "updated" | "no_action";
    memoryId?: string;
    status?: MemoryStatus;
};
