import { describe, expect, it } from "vitest";

import { assessEarlyUnderstanding, isSafeEarlyText } from "./early-understanding.service.ts";

const chaos = (day: number, source?: string) => ({
    signalType: "mood_observation",
    value: { mood: "Chaos" },
    observedAt: `2026-09-${10 + day}T10:00:00Z`,
    ...(source ? { sourceKey: source } : {}),
});

const sad = (day: number, source?: string) => ({
    signalType: "mood_state",
    value: { state: "low" },
    observedAt: `2026-09-${10 + day}T18:00:00Z`,
    ...(source ? { sourceKey: source } : {}),
});

describe("Early Understanding", () => {
    it("immediate notice: a single check-in is noticed without claiming a pattern", () => {
        const result = assessEarlyUnderstanding([chaos(0, "check-in:1")]);
        expect(result.level).toBe("notice");
        expect(result.noticeText).toMatch(/I noticed/i);
        expect(result.noticeText).not.toMatch(/pattern/i);
        expect(isSafeEarlyText(result.noticeText!)).toBe(true);
    });

    it("emerging relationship: 2 Chaos check-ins + sad stays emerging, never a formal pattern", () => {
        const result = assessEarlyUnderstanding([chaos(0, "check-in:1"), chaos(1, "check-in:2"), sad(1, "message:3")]);
        expect(result.level).toBe("emerging");
        expect(result.noticeText).toMatch(/I don't know if they're connected yet/i);
        expect(result.noticeText).toMatch(/I'll keep watching/i);
        expect(result.noticeText).not.toMatch(/pattern/i);
    });

    it("formal pattern: 3x same concept defers to the Pattern Engine and stays silent", () => {
        const result = assessEarlyUnderstanding([chaos(0, "check-in:1"), chaos(1, "check-in:2"), chaos(2, "check-in:3")]);
        expect(result.level).toBe("pattern_ready");
        expect(result.noticeText).toBeNull();
    });

    it("insufficient evidence: no signals produce no notice", () => {
        const result = assessEarlyUnderstanding([]);
        expect(result.level).toBe("insufficient");
        expect(result.noticeText).toBeNull();
    });

    it("contradictory evidence: Chaos + Good never claims a connection", () => {
        const result = assessEarlyUnderstanding([
            chaos(0, "check-in:1"),
            { signalType: "mood_observation", value: { mood: "Good" }, observedAt: "2026-09-11T10:00:00Z", sourceKey: "check-in:2" },
        ]);
        expect(result.level).toBe("contradictory");
        expect(result.noticeText).toMatch(/mixed|won't assume/i);
        expect(result.noticeText).not.toMatch(/pattern/i);
        expect(result.noticeText).not.toMatch(/causes|proves/i);
    });

    it("never fabricates: emerging text uses only real signal wording", () => {
        const result = assessEarlyUnderstanding([chaos(0, "check-in:1"), sad(0, "message:2")]);
        expect(result.level).toBe("emerging");
        expect(result.noticeText).toMatch(/chaos/i);
        expect(result.noticeText).toMatch(/sad/i);
    });
});
