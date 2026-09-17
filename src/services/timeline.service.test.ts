import { describe, expect, it, vi } from "vitest";

import {
    groupTimelineItems,
    timelineTargetFor,
} from "./timeline.service";
import type { TimelineItem } from "@/types/timeline";

vi.hoisted(() => ({
    list: vi.fn(),
}));

vi.mock("@/repositories/timeline.repository", () => ({
    timelineRepository: { list: vi.fn() },
}));

function boundary(daysFromToday: number): Date {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() + daysFromToday);
    return start;
}

function item(partial: Partial<TimelineItem> & { eventType: TimelineItem["eventType"]; createdAt: string }): TimelineItem {
    return {
        id: "id-" + Math.random(),
        title: "Title",
        description: null,
        referenceId: "ref-" + Math.random(),
        metadata: {},
        ...partial,
    };
}

describe("groupTimelineItems", () => {
    it("groups items into Today, Yesterday, This week, and Older", () => {
        const startToday = boundary(0);
        const startYesterday = boundary(-1);
        const startWeek = boundary(-6);
        const lessThanDay = 3600 * 1000 * 2;

        const sections = groupTimelineItems([
            item({ eventType: "insight", createdAt: new Date(startWeek.getTime() - 3600 * 1000).toISOString() }),
            item({ eventType: "reflection", createdAt: new Date(startToday.getTime() + lessThanDay).toISOString() }),
            item({ eventType: "check_in", createdAt: new Date(startYesterday.getTime() + lessThanDay).toISOString() }),
            item({ eventType: "conversation", createdAt: new Date(startWeek.getTime() + lessThanDay).toISOString() }),
            item({ eventType: "experiment", createdAt: new Date(boundary(-12).getTime() + lessThanDay).toISOString() }),
        ]);

        expect(sections.map((section) => section.title)).toEqual(["Today", "Yesterday", "This week", "Older"]);
        expect(sections[0].data.map((entry) => entry.eventType)).toEqual(["reflection"]);
        expect(sections[1].data.map((entry) => entry.eventType)).toEqual(["check_in"]);
        expect(sections[2].data.map((entry) => entry.eventType)).toEqual(["conversation"]);
        expect(sections[3].data.map((entry) => entry.eventType)).toEqual(["insight", "experiment"]);
    });

    it("drops sections with no matching items", () => {
        const sections = groupTimelineItems([
            item({ eventType: "learning", createdAt: new Date().toISOString() }),
        ]);
        expect(sections.map((section) => section.title)).toEqual(["Today"]);
    });

    it("keeps newest-first order within a section", () => {
        const now = new Date();
        const sections = groupTimelineItems([
            item({ eventType: "learning", createdAt: now.toISOString() }),
            item({ eventType: "insight", createdAt: new Date(now.getTime() - 60_000).toISOString() }),
        ]);
        expect(sections[0].data.map((entry) => entry.eventType)).toEqual(["learning", "insight"]);
    });
});

describe("timelineTargetFor", () => {
    it("maps events without a reference id to list screens", () => {
        expect(timelineTargetFor(item({ eventType: "reflection", createdAt: new Date().toISOString(), referenceId: null }))).toEqual({ screen: "Reflections" });
        expect(timelineTargetFor(item({ eventType: "check_in", createdAt: new Date().toISOString(), referenceId: null }))).toEqual({ screen: "CheckIns" });
    });

    it("maps reference-backed events to detail screens", () => {
        expect(timelineTargetFor(item({ eventType: "conversation", createdAt: new Date().toISOString(), referenceId: "conversation-1" }))).toEqual({ screen: "ConversationDetail", params: { conversationId: "conversation-1" } });
        expect(timelineTargetFor(item({ eventType: "pattern", createdAt: new Date().toISOString() }))).toEqual({ screen: "PatternDetail", params: expect.objectContaining({ patternId: expect.any(String) }) });
        expect(timelineTargetFor(item({ eventType: "experiment", createdAt: new Date().toISOString() }))).toEqual({ screen: "ExperimentDetail", params: expect.objectContaining({ experimentId: expect.any(String) }) });
        expect(timelineTargetFor(item({ eventType: "learning", createdAt: new Date().toISOString() }))).toEqual({ screen: "LearningDetail", params: expect.objectContaining({ learningId: expect.any(String) }) });
        expect(timelineTargetFor(item({ eventType: "insight", createdAt: new Date().toISOString() }))).toEqual({ screen: "InsightDetail", params: expect.objectContaining({ insightId: expect.any(String) }) });
    });

    it("returns null when a detail screen requires a missing reference id", () => {
        expect(timelineTargetFor(item({ eventType: "conversation", createdAt: new Date().toISOString(), referenceId: null }))).toBeNull();
    });
});