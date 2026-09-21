import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./date";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

describe("formatRelativeTime", () => {
    it("never invents a time when there is no timestamp", () => {
        expect(formatRelativeTime(null)).toBeNull();
        expect(formatRelativeTime(undefined)).toBeNull();
        expect(formatRelativeTime("not-a-date")).toBeNull();
    });

    it("describes recent syncs in coarse, honest units", () => {
        expect(formatRelativeTime(minutesAgo(0))).toBe("just now");
        expect(formatRelativeTime(minutesAgo(12))).toBe("12m ago");
        expect(formatRelativeTime(minutesAgo(180))).toBe("3h ago");
        expect(formatRelativeTime(minutesAgo(60 * 24 * 3))).toBe("3d ago");
    });

    it("falls back to a real date for anything older than a week", () => {
        const old = minutesAgo(60 * 24 * 30);
        expect(formatRelativeTime(old)).toBe(new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(old)));
    });
});
