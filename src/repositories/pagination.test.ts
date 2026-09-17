import { describe, expect, it } from "vitest";

import { pageRange } from "./pagination";

describe("repository pagination", () => {
    it("creates non-overlapping ranges", () => {
        expect(pageRange(0, 20)).toEqual({ from: 0, to: 19, pageSize: 20 });
        expect(pageRange(1, 20)).toEqual({ from: 20, to: 39, pageSize: 20 });
    });

    it("bounds invalid and oversized page values", () => {
        expect(pageRange(-2, 0)).toEqual({ from: 0, to: 0, pageSize: 1 });
        expect(pageRange(2, 100)).toEqual({ from: 100, to: 149, pageSize: 50 });
    });
});
