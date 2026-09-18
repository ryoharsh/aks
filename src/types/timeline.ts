import type { YourDataStackParamList } from "@/navigation/routes";

export const TIMELINE_EVENT_TYPES = [
    "reflection",
    "check_in",
    "conversation",
    "pattern",
    "experiment",
    "learning",
    "insight",
] as const;

export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

export const TIMELINE_FILTERS = ["All", "Insights", "Experiments", "Check-ins", "Decisions", "Learnings"] as const;

export type TimelineFilter = (typeof TIMELINE_FILTERS)[number];

export const TIMELINE_GROUPS = ["Today", "Yesterday", "This week", "Older"] as const;

export type TimelineGroup = (typeof TIMELINE_GROUPS)[number];

export type TimelineItem = {
    id: string;
    eventType: TimelineEventType;
    title: string;
    description: string | null;
    referenceId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
};

export type TimelineEntryCategory = "insights" | "experiments" | "check-ins" | "decisions" | "learnings" | "all";

export type TimelineEntry = {
    id: string;
    source: TimelineItem;
    sourceIds: string[];
    type: TimelineEventType;
    category: TimelineEntryCategory;
    eyebrow: string | null;
    title: string;
    description: string | null;
    createdAt: string;
    priority: number;
};

export type TimelineSection = {
    title: string;
    data: TimelineItem[];
};

export type TimelineNavigationTarget =
    | { screen: "InsightDetail"; params: YourDataStackParamList["InsightDetail"] }
    | { screen: "ExperimentDetail"; params: YourDataStackParamList["ExperimentDetail"] }
    | { screen: "LearningDetail"; params: YourDataStackParamList["LearningDetail"] }
    | { screen: "PatternDetail"; params: YourDataStackParamList["PatternDetail"] }
    | { screen: "ConversationDetail"; params: YourDataStackParamList["ConversationDetail"] }
    | { screen: "Reflections" }
    | { screen: "CheckIns" };

export const timelineFilterToEventTypes: Record<Exclude<TimelineFilter, "All">, TimelineEventType[]> = {
    Insights: ["pattern", "insight", "learning"],
    Experiments: ["experiment"],
    "Check-ins": ["check_in"],
    Decisions: ["pattern"],
    Learnings: ["learning", "reflection"],
};

export const eventTypeToLabel: Record<TimelineEventType, string> = {
    reflection: "Reflection",
    check_in: "Check-in",
    conversation: "Conversation",
    pattern: "Decision",
    experiment: "Experiment",
    learning: "Learning",
    insight: "Insight",
};
