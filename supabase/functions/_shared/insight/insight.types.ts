export type InsightStatus = "new" | "seen" | "dismissed" | "archived";
export type InsightAction = { action: "created" | "skipped" | "no_action"; insightId?: string };

export type InsightProposal = {
    decision: "create" | "update" | "skip";
    insight: { type: string; title: string; content: string };
    confidence: number;
    patternId: string | null;
    experimentId: string;
    learningId: string;
};
