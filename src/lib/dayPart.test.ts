import { describe, expect, it } from "vitest";

import { getDayPart } from "./dayPart";

const atHour = (hour: number) => new Date(2026, 8, 21, hour, 30, 0);

describe("getDayPart", () => {
    it("buckets local hours into morning/afternoon/evening/night", () => {
        expect(getDayPart(atHour(6))).toBe("morning");
        expect(getDayPart(atHour(11))).toBe("morning");
        expect(getDayPart(atHour(12))).toBe("afternoon");
        expect(getDayPart(atHour(16))).toBe("afternoon");
        expect(getDayPart(atHour(17))).toBe("evening");
        expect(getDayPart(atHour(20))).toBe("evening");
        expect(getDayPart(atHour(21))).toBe("night");
        expect(getDayPart(atHour(0))).toBe("night");
        expect(getDayPart(atHour(4))).toBe("night");
    });

    it("hits every boundary exactly", () => {
        expect(getDayPart(new Date(2026, 8, 21, 5, 0, 0))).toBe("morning");
        expect(getDayPart(new Date(2026, 8, 21, 11, 59, 59))).toBe("morning");
        expect(getDayPart(new Date(2026, 8, 21, 12, 0, 0))).toBe("afternoon");
        expect(getDayPart(new Date(2026, 8, 21, 16, 59, 59))).toBe("afternoon");
        expect(getDayPart(new Date(2026, 8, 21, 17, 0, 0))).toBe("evening");
        expect(getDayPart(new Date(2026, 8, 21, 20, 59, 59))).toBe("evening");
        expect(getDayPart(new Date(2026, 8, 21, 21, 0, 0))).toBe("night");
        expect(getDayPart(new Date(2026, 8, 21, 4, 59, 59))).toBe("night");
    });
});
