import { describe, expect, it, vi } from "vitest";

import {
    curateTimelineEntries,
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

describe("curateTimelineEntries", () => {
    it("keeps semantic entries and reduces conversations to one per day", () => {
        const now = new Date();
        const conversation = item({ eventType: "conversation", createdAt: now.toISOString(), title: "First thought" });
        const secondConversation = item({ eventType: "conversation", createdAt: new Date(now.getTime() - 60_000).toISOString(), title: "Another thought" });
        const experiment = item({ eventType: "experiment", createdAt: now.toISOString(), metadata: { status: "completed" }, title: "Experiment result" });

        const entries = curateTimelineEntries([conversation, secondConversation, experiment]);

        expect(entries).toHaveLength(2);
        expect(entries.find((entry) => entry.type === "experiment")?.eyebrow).toBe("OUTCOME RECORDED");
        expect(entries.filter((entry) => entry.type === "conversation")).toHaveLength(1);
        expect(entries.find((entry) => entry.type === "conversation")?.title).toBe("First thought");
        expect(entries.find((entry) => entry.type === "experiment")?.sourceIds).toEqual([experiment.id]);
    });

    it("keeps conversations from different local days and semantic entries from the same day", () => {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const entries = curateTimelineEntries([
            item({ eventType: "conversation", createdAt: now.toISOString() }),
            item({ eventType: "conversation", createdAt: yesterday.toISOString() }),
            item({ eventType: "insight", createdAt: now.toISOString() }),
            item({ eventType: "check_in", createdAt: now.toISOString() }),
        ]);

        expect(entries.filter((entry) => entry.type === "conversation")).toHaveLength(2);
        expect(entries.filter((entry) => entry.createdAt === now.toISOString())).toHaveLength(3);
    });

    it("labels active and started experiments distinctly", () => {
        const now = new Date().toISOString();
        const entries = curateTimelineEntries([
            item({ eventType: "experiment", createdAt: now, metadata: { status: "active" } }),
            item({ eventType: "experiment", createdAt: now, metadata: { status: "draft" } }),
        ]);

        expect(entries.map((entry) => entry.eyebrow).sort()).toEqual(["EXPERIMENT ACTIVE", "EXPERIMENT STARTED"]);
    });

    it("sorts newest first without mutating raw items", () => {
        const older = item({ eventType: "learning", createdAt: "2026-09-01T10:00:00.000Z" });
        const newer = item({ eventType: "pattern", createdAt: "2026-09-02T10:00:00.000Z" });
        const raw = [older, newer];
        const snapshot = raw.map((entry) => ({ ...entry, metadata: { ...entry.metadata } }));

        const entries = curateTimelineEntries(raw);

        expect(entries.map((entry) => entry.source.id)).toEqual([newer.id, older.id]);
        expect(raw).toEqual(snapshot);
    });
});