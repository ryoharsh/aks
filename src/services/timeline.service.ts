import { timelineRepository } from "@/repositories/timeline.repository";
import type {
    TimelineGroup,
    TimelineItem,
    TimelineNavigationTarget,
    TimelineSection,
} from "@/types/timeline";

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