export type PatternStatus = "candidate" | "possible" | "testing" | "supported" | "not_supported" | "archived";
export type PatternRelationship = "recurrence" | "association" | "sequence";

export type PatternSignal = {
    id: string;
    signalType: string;
    value: unknown;
    conceptKey: string;
    observedAt: string;
    sourceKey: string;
    sourceExcerpt: string | null;
};

export type ExistingPattern = {
    id: string;
    title: string;
    description: string;
    canonicalKey: string;
    status: Exclude<PatternStatus, "archived">;
    confidence: number | null;
    evidenceCount: number;
    relationship: PatternRelationship;
    conceptKeys: string[];
};

export type PatternProposal = {
    decision: "create" | "update" | "not_supported";
    title: string;
    description: string;
    relationship: PatternRelationship;
    conceptKeys: string[];
    confidence: number;
    signalIds: string[];
    existingPatternId: string | null;
    alternativeExplanation: string | null;
};

export type PatternAction = { action: "created" | "updated" | "no_action"; patternId?: string; status?: PatternStatus };
