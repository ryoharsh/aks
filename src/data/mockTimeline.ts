import type { IconSvgElement } from "@hugeicons/react-native";
import {
    BookOpen01Icon,
    CheckListIcon,
    Note01Icon,
    SparklesIcon,
    Target01Icon,
} from "@hugeicons/core-free-icons";

export type TimelineFilter = "All" | "Insights" | "Experiments" | "Check-ins" | "Decisions";
export type TimelineGroup = "Today" | "Yesterday" | "This week" | "Older";
export type TimelineEvent = {
    id: string;
    type: Exclude<TimelineFilter, "All"> | "Reflection" | "Learning";
    group: TimelineGroup;
    title: string;
    description: string;
    time: string;
    annotation?: string;
    icon: IconSvgElement;
};

export const timelineFilters: TimelineFilter[] = ["All", "Insights", "Experiments", "Check-ins", "Decisions"];
export const timelineGroups: TimelineGroup[] = ["Today", "Yesterday", "This week", "Older"];

export const mockTimelineEvents: TimelineEvent[] = [
    {
        id: "timeline-1",
        type: "Insights",
        group: "Today",
        title: "Aks noticed a recurring connection",
        description: "Your higher-focus check-ins appeared more often on mornings with fewer commitments.",
        time: "10:42 AM",
        annotation: "Pattern forming",
        icon: SparklesIcon,
    },
    {
        id: "timeline-2",
        type: "Check-ins",
        group: "Today",
        title: "Morning check-in",
        description: "Energy · Good    Focus · Clear",
        time: "8:20 AM",
        icon: CheckListIcon,
    },
    {
        id: "timeline-3",
        type: "Experiments",
        group: "Yesterday",
        title: "Experiment started",
        description: "Phone-free first hour · 7 days",
        time: "8:30 PM",
        annotation: "Experiment active",
        icon: Target01Icon,
    },
    {
        id: "timeline-4",
        type: "Reflection",
        group: "Yesterday",
        title: "You captured a reflection",
        description: "A quieter morning made it easier to begin one task without switching.",
        time: "9:15 AM",
        icon: Note01Icon,
    },
    {
        id: "timeline-5",
        type: "Learning",
        group: "This week",
        title: "A new learning took shape",
        description: "Slower mornings may help your focus when the first task is clearly defined.",
        time: "Monday · 6:40 PM",
        annotation: "New learning",
        icon: BookOpen01Icon,
    },
    {
        id: "timeline-6",
        type: "Decisions",
        group: "This week",
        title: "You made a decision",
        description: "Keep the phone-free first hour on weekdays.",
        time: "Sunday · 7:10 PM",
        icon: CheckListIcon,
    },
    {
        id: "timeline-7",
        type: "Experiments",
        group: "Older",
        title: "Experiment outcome recorded",
        description: "A short walk after lunch often coincided with steadier afternoon energy.",
        time: "September 6 · 5:30 PM",
        annotation: "Outcome recorded",
        icon: Target01Icon,
    },
];
