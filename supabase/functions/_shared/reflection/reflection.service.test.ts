import { describe, expect, it } from "vitest";

import { validateReflectionSignals } from "./reflection.service.ts";

describe("reflection signal extraction", () => {
    it("accepts valid reflection signals", () => {
        const signals = validateReflectionSignals(JSON.stringify({
            signals: [
                { signalType: "difficulty_starting", value: { present: true }, confidence: 0.8 },
                { signalType: "stress_level", value: { level: "high" }, confidence: 0.7 },
                { signalType: "sleep_quality", value: { quality: "worse" }, confidence: null },
            ],
        }));
        expect(signals).toHaveLength(3);
        expect(signals[0]).toEqual({ signalType: "difficulty_starting", value: { present: true }, confidence: 0.8 });
        expect(signals[2]).toEqual({ signalType: "sleep_quality", value: { quality: "worse" }, confidence: null });
    });

    it("drops unsupported signal types, invalid values, and duplicate types", () => {
        const signals = validateReflectionSignals(JSON.stringify({
            signals: [
                { signalType: "diagnosis", value: { label: "unsupported" }, confidence: 0.9 },
                { signalType: "focus_difficulty", value: { present: true, period: "weekend" }, confidence: 0.5 },
                { signalType: "mood_state", value: { state: "low" }, confidence: 0.8 },
                { signalType: "mood_state", value: { state: "positive" }, confidence: 0.4 },
                { signalType: "energy_change", value: { direction: "sideways" } },
            ],
        }));
        expect(signals).toEqual([{ signalType: "mood_state", value: { state: "low" }, confidence: 0.8 }]);
    });

    it("caps signals at three and rejects malformed JSON", () => {
        const many = validateReflectionSignals(JSON.stringify({
            signals: [
                { signalType: "avoidance", value: { present: true } },
                { signalType: "difficulty_starting", value: { present: true } },
                { signalType: "routine_change", value: { changed: true } },
                { signalType: "stress_level", value: { level: "low" } },
            ],
        }));
        expect(many).toHaveLength(3);
        expect(() => validateReflectionSignals("not json")).toThrow();
        expect(() => validateReflectionSignals(JSON.stringify({ signals: "nope" }))).toThrow("INVALID_AI_SIGNALS");
    });
});
