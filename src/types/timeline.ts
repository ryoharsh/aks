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

export const TIMELINE_FILTERS = ["All", "Insights", "Experiments", "Check-ins", "Decisions"] as const;

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

export const timelineFilterToEventType: Record<Exclude<TimelineFilter, "All">, TimelineEventType> = {
    Insights: "insight",
    Experiments: "experiment",
    "Check-ins": "check_in",
    Decisions: "pattern",
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
