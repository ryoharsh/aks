export type EarlySignal = {
    signalType: string;
    value: unknown;
    observedAt: string;
    sourceKey?: string | null;
};

export type EarlyLevel =
    | "insufficient"
    | "notice"
    | "emerging"
    | "pattern_ready"
    | "contradictory";

export type EarlyUnderstanding = {
    level: EarlyLevel;
    /** Deterministic, signal-grounded wording for Mirror. Null when silent. Never contains "pattern". */
    noticeText: string | null;
    signalCount: number;
    distinctSources: number;
    /** True when a real notice/emerging finding was suppressed as already-surfaced (novelty) or owned by a formal pattern (continuity). */
    deduplicated?: boolean;
};
