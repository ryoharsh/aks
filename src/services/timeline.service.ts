import { timelineRepository } from "@/repositories/timeline.repository";
import type {
    TimelineGroup,
    TimelineEntry,
    TimelineItem,
    TimelineNavigationTarget,
    TimelineSection,
} from "@/types/timeline";

const priorityFor: Record<TimelineItem["eventType"], number> = {
    pattern: 100,
    insight: 95,
    learning: 90,
    experiment: 80,
    reflection: 75,
    check_in: 50,
    conversation: 20,
};

function eyebrowFor(item: TimelineItem): string | null {
    if (item.eventType === "pattern") {
        return "PATTERN FORMING";
    }
    if (item.eventType === "insight") {
        return "INSIGHT";
    }
    if (item.eventType === "learning") {
        return "NEW LEARNING";
    }
    if (item.eventType === "experiment") {
        const completed = item.metadata.status === "completed";
        if (completed) return "OUTCOME RECORDED";
        if (item.metadata.status === "started" || item.metadata.status === "draft") return "EXPERIMENT STARTED";
        return "EXPERIMENT ACTIVE";
    }
    if (item.eventType === "reflection") return "REFLECTION";
    if (item.eventType === "check_in") return "CHECK-IN";
    return null;
}

function presentationFor(item: TimelineItem): Omit<TimelineEntry, "id" | "source" | "sourceIds" | "createdAt"> {
    const completed = item.eventType === "experiment" && item.metadata.status === "completed";
    return {
        type: item.eventType,
        category: item.eventType === "pattern" ? "decisions" : item.eventType === "insight" ? "insights" : item.eventType === "experiment" ? "experiments" : item.eventType === "check_in" ? "check-ins" : item.eventType === "learning" ? "learnings" : "all",
        eyebrow: eyebrowFor(item),
        title: completed ? "Experiment outcome recorded" : item.eventType === "reflection" ? "You captured a reflection" : item.title,
        description: item.description,
        priority: priorityFor[item.eventType],
    };
}

function localCalendarDay(value: string) {
    const date = new Date(value);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function curateTimelineEntries(items: TimelineItem[]): TimelineEntry[] {
    const newestConversationByDay = new Map<string, TimelineItem>();
    const semanticItems: TimelineItem[] = [];

    for (const item of items) {
        if (item.eventType !== "conversation") {
            semanticItems.push(item);
            continue;
        }
        const day = localCalendarDay(item.createdAt);
        const current = newestConversationByDay.get(day);
        if (!current || new Date(item.createdAt).getTime() > new Date(current.createdAt).getTime()) {
            newestConversationByDay.set(day, item);
        }
    }

    return [...semanticItems, ...newestConversationByDay.values()]
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        .map((item) => ({
            id: item.id,
            source: item,
            sourceIds: [item.id],
            createdAt: item.createdAt,
            ...presentationFor(item),
        }));
}

export const timelineService = {
    list: timelineRepository.list,
};

export function groupTimelineItems(items: TimelineItem[]): TimelineSection[] {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startYesterday = new Date(startToday);
    startYesterday.setDate(startYesterday.getDate() - 1);
    const startWeek = new Date(startToday);
    startWeek.setDate(startWeek.getDate() - 6);

    const groups: TimelineGroup[] = ["Today", "Yesterday", "This week", "Older"];

    return groups
        .map((group) => ({
            title: group,
            data: items.filter((item) => {
                const created = new Date(item.createdAt);
                switch (group) {
                    case "Today":
                        return created >= startToday;
                    case "Yesterday":
                        return created >= startYesterday && created < startToday;
                    case "This week":
                        return created >= startWeek && created < startYesterday;
                    default:
                        return created < startWeek;
                }
            }),
        }))
        .filter((section) => section.data.length > 0);
}

export function timelineTargetFor(item: TimelineItem): TimelineNavigationTarget | null {
    switch (item.eventType) {
        case "reflection":
            return { screen: "Reflections" };
        case "check_in":
            return { screen: "CheckIns" };
        case "conversation":
            return item.referenceId
                ? { screen: "ConversationDetail", params: { conversationId: item.referenceId } }
                : null;
        case "pattern":
            return item.referenceId
                ? { screen: "PatternDetail", params: { patternId: item.referenceId } }
                : null;
        case "experiment":
            return item.referenceId
                ? { screen: "ExperimentDetail", params: { experimentId: item.referenceId } }
                : null;
        case "learning":
            return item.referenceId
                ? { screen: "LearningDetail", params: { learningId: item.referenceId } }
                : null;
        case "insight":
            return item.referenceId
                ? { screen: "InsightDetail", params: { insightId: item.referenceId } }
                : null;
    }
}

export function groupTimelineEntries(entries: TimelineEntry[]) {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startYesterday = new Date(startToday);
    startYesterday.setDate(startYesterday.getDate() - 1);
    const startWeek = new Date(startToday);
    startWeek.setDate(startWeek.getDate() - 6);
    const groups = ["Today", "Yesterday", "This week", "Older"] as const;

    return groups
        .map((group) => ({
            title: group,
            data: entries.filter((entry) => {
                const created = new Date(entry.createdAt);
                if (group === "Today") return created >= startToday;
                if (group === "Yesterday") return created >= startYesterday && created < startToday;
                if (group === "This week") return created >= startWeek && created < startYesterday;
                return created < startWeek;
            }),
        }))
        .filter((section) => section.data.length > 0);
}