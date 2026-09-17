import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import type { Page, PageOptions } from "@/types/data";
import type { TimelineEventType, TimelineItem } from "@/types/timeline";
import { requireAuthenticatedUser, throwDataError } from "./data.repository";
import { pageRange } from "./pagination";

type Row = Database["public"]["Tables"]["timeline_events"]["Row"];

export type TimelineListOptions = PageOptions & {
    eventType?: TimelineEventType;
};

const mapTimelineEvent = (row: Row): TimelineItem => ({
    id: row.id,
    eventType: row.event_type as TimelineEventType,
    title: row.title,
    description: row.description,
    referenceId: row.reference_id,
    metadata: row.metadata as Record<string, unknown>,
    createdAt: row.created_at,
});

export const timelineRepository = {
    async list(options: TimelineListOptions = {}): Promise<Page<TimelineItem>> {
        await requireAuthenticatedUser();
        const { from, to, pageSize } = pageRange(options.page, options.pageSize);
        let query = supabase
            .from("timeline_events")
            .select()
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to + 1);
        if (options.eventType !== undefined) {
            query = query.eq("event_type", options.eventType);
        }
        const { data, error } = await query;
        if (error) throwDataError(error);
        return {
            items: data.slice(0, pageSize).map(mapTimelineEvent),
            hasMore: data.length > pageSize,
        };
    },
};