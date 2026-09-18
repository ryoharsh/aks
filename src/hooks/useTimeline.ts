import { useCallback, useEffect } from "react";

import { usePagedData } from "./usePagedData";
import { dataEvents, type DataEvent } from "@/services/dataEvents";
import { timelineService } from "@/services/timeline.service";
import type { PageOptions } from "@/types/data";
import { timelineFilterToEventTypes, type TimelineFilter } from "@/types/timeline";

const TIMELINE_EVENTS: DataEvent[] = [
    "conversations",
    "conversationArchived",
    "messages",
    "reflections",
    "checkIns",
    "signals",
    "memories",
    "patterns",
    "experiments",
    "learnings",
    "insights",
];

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export function useTimeline(filter: TimelineFilter) {
    const eventTypes = filter === "All" ? undefined : timelineFilterToEventTypes[filter];
    const loader = useCallback(
        (options: PageOptions) => timelineService.list({ ...options, eventTypes }),
        [eventTypes],
    );
    const page = usePagedData(loader);

    useEffect(() => {
        const unsubscribe = TIMELINE_EVENTS.map((event) =>
            dataEvents.subscribe(event, () => { void page.refresh(); }),
        );
        const interval = setInterval(() => { void page.refresh(); }, REFRESH_INTERVAL_MS);
        return () => {
            unsubscribe.forEach((stop) => stop());
            clearInterval(interval);
        };
    }, [page.refresh]);

    return page;
}