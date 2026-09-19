import { describe, expect, it } from "vitest";

import { canDeliverNow, evaluatePolicy, isWithinQuietHours, localMinuteOf, nextEligibleLocalTime, normalizePreferences, retryDelayMinutes, timezoneOffsetMinutes } from "./policy.ts";

const utc = (iso: string) => new Date(iso);

function prefs(overrides: Partial<ReturnType<typeof normalizePreferences>> = {}) {
    const base = normalizePreferences({
        notifications_enabled: true,
        notification_categories: { insights: true, experiments: true, checkIns: true, weekly: true },
        quiet_hours_enabled: false,
        timezone: "UTC",
    } as never);
    return { ...base, ...overrides };
}

describe("notification policy — preference gating", () => {
    const candidate = { category: "insights" as const };

    it("delivers when enabled and category enabled", () => {
        expect(evaluatePolicy(candidate, prefs())).toEqual({ deliverable: true });
    });

    it("blocks when global notifications are disabled", () => {
        expect(evaluatePolicy(candidate, prefs({ notificationsEnabled: false }))).toEqual({ deliverable: false, reason: "globally_disabled" });
    });

    it("blocks each disabled category independently", () => {
        for (const category of ["insights", "experiments", "checkIns", "weekly"] as const) {
            const categoryPrefs = prefs();
            categoryPrefs.categories = { insights: true, experiments: true, checkIns: true, weekly: true, [category]: false } as never;
            const decision = evaluatePolicy({ category }, categoryPrefs);
            expect(decision).toEqual({ deliverable: false, reason: "category_disabled" });
        }
    });
});

describe("quiet hours", () => {
    const quietPrefs = (timezone: string) => prefs({ quietHoursEnabled: true, timezone });

    it("suppresses inside a normal (same-day) range", () => {
        // 23:00 UTC is minute 1380; range 22:00-23:59.
        expect(isWithinQuietHours(quietPrefs("UTC"), utc("2026-09-20T23:00:00Z"))).toBe(true);
    });

    it("allows outside a normal range", () => {
        expect(isWithinQuietHours(quietPrefs("UTC"), utc("2026-09-20T12:00:00Z"))).toBe(false);
    });

    it("suppresses in a range crossing midnight — late side", () => {
        // Range 22:00 -> 07:00; 23:30 UTC is inside.
        expect(isWithinQuietHours(quietPrefs("UTC"), utc("2026-09-20T23:30:00Z"))).toBe(true);
    });

    it("suppresses in a range crossing midnight — early side", () => {
        // 05:00 UTC is inside 22:00 -> 07:00 (before the 07:00 end).
        expect(isWithinQuietHours(quietPrefs("UTC"), utc("2026-09-20T05:00:00Z"))).toBe(true);
        // 08:00 UTC is after the 07:00 end -> allowed.
        expect(isWithinQuietHours(quietPrefs("UTC"), utc("2026-09-20T08:00:00Z"))).toBe(false);
    });
});

describe("timezone handling", () => {
    it("computes local minutes for a positive-offset zone", () => {
        // 18:00 UTC = 23:30 IST (+5:30) -> minute 1410.
        expect(localMinuteOf(utc("2026-09-20T18:00:00Z"), "Asia/Kolkata")).toBe(1410);
        expect(timezoneOffsetMinutes(utc("2026-09-20T18:00:00Z"), "Asia/Kolkata")).toBe(330);
    });

    it("computes local minutes for a negative-offset zone", () => {
        // 04:00 UTC = 00:00 EDT (UTC-4) -> minute 0.
        expect(localMinuteOf(utc("2026-09-20T04:00:00Z"), "America/New_York")).toBe(0);
    });

    it("midnight-crossing quiet hours evaluate in the user's zone, not the server's", () => {
        // 21:00 UTC = 02:30 IST (inside 22:00-07:00 IST window) -> quiet.
        const ist = prefs({ quietHoursEnabled: true, timezone: "Asia/Kolkata" });
        expect(isWithinQuietHours(ist, utc("2026-09-20T21:00:00Z"))).toBe(true);
        // Same instant with UTC prefs (21:00 local) is NOT quiet (starts 22:00).
        const utcPrefs = prefs({ quietHoursEnabled: true, timezone: "UTC" });
        expect(isWithinQuietHours(utcPrefs, utc("2026-09-20T21:00:00Z"))).toBe(false);
    });

    it("blocks quiet-hour candidates with the dedicated reason", () => {
        const quietPrefsAtNoon = prefs({ quietHoursEnabled: true, timezone: "UTC" });
        const decision = canDeliverNow({ category: "weekly" }, quietPrefsAtNoon, utc("2026-09-20T23:00:00Z"));
        expect(decision).toEqual({ deliverable: false, reason: "quiet_hours" });
    });
});

describe("scheduling helpers", () => {
    it("picks the next local 19:00 outside quiet hours", () => {
        const quietPrefs = prefs({ quietHoursEnabled: true, timezone: "UTC" });
        const from = utc("2026-09-20T10:00:00Z");
        const next = nextEligibleLocalTime(quietPrefs, from, 19, 0);
        expect(next.toISOString()).toBe("2026-09-20T19:00:00.000Z");
    });

    it("rolls forward past a quiet-hours collision", () => {
        // 19:00 local falls inside an 18:00-20:00 quiet window; the scheduler
        // rolls forward in 30-minute steps to the first eligible instant (20:00).
        const collisionPrefs = prefs({ quietHoursEnabled: true, timezone: "UTC" });
        collisionPrefs.quietHours = { startMinute: 18 * 60, endMinute: 20 * 60 };
        const next = nextEligibleLocalTime(collisionPrefs, utc("2026-09-20T10:00:00Z"), 19, 0);
        expect(next.toISOString()).toBe("2026-09-20T20:00:00.000Z");
    });

    it("caps retries with growing backoff", () => {
        expect(retryDelayMinutes(0)).toBe(5);
        expect(retryDelayMinutes(1)).toBe(30);
        expect(retryDelayMinutes(2)).toBe(240);
        expect(retryDelayMinutes(3)).toBeNull();
    });
});
