import { describe, expect, it } from "vitest";

import { assessEarlyUnderstanding } from "./early-understanding.service.ts";
import { resolveEarlyUnderstanding } from "./early-understanding.novelty.ts";
import { buildMirrorContext } from "../mirror/context.ts";

const chaos = (index: number) => ({
    signalType: "mood_observation",
    value: { mood: "Chaos" },
    observedAt: `2026-09-${10 + Math.floor(index / 4)}T${10 + (index % 4)}:00:00Z`,
    sourceKey: `check-in:${index}`,
});

const assistantSaying = (content: string) => ({ role: "assistant" as const, content, createdAt: "2026-09-12T10:00:00Z" });

describe("Early Understanding safeguards", () => {
    it("duplicate notice suppression: same observation is not shown twice", () => {
        const signals = [chaos(0), chaos(1)];
        const first = resolveEarlyUnderstanding({ signals, recentMessages: [] });
        expect(first.noticeText).toMatch(/I noticed/i);

        const second = resolveEarlyUnderstanding({
            signals,
            recentMessages: [assistantSaying(first.noticeText!)],
        });
        expect(second.noticeText).toBeNull();
        expect(second.deduplicated).toBe(true);
        expect(second.level).toBe(first.level);
    });

    it("same signal repeated across messages: second turn stays silent", () => {
        const turnOne = resolveEarlyUnderstanding({ signals: [chaos(0)], recentMessages: [] });
        expect(turnOne.level).toBe("notice");
        expect(turnOne.noticeText).toMatch(/chaos/i);

        const turnTwo = resolveEarlyUnderstanding({
            signals: [chaos(0)],
            recentMessages: [assistantSaying(turnOne.noticeText!)],
        });
        expect(turnTwo.noticeText).toBeNull();
        expect(turnTwo.deduplicated).toBe(true);
    });

    it("early → pattern transition: emerging hands off to silence at 3x same concept", () => {
        const emerging = resolveEarlyUnderstanding({ signals: [chaos(0), chaos(1)], recentMessages: [] });
        expect(emerging.level).toBe("emerging");
        expect(emerging.noticeText).toMatch(/I'll keep watching/i);

        const ready = resolveEarlyUnderstanding({ signals: [chaos(0), chaos(1), chaos(2)], recentMessages: [] });
        expect(ready.level).toBe("pattern_ready");
        expect(ready.noticeText).toBeNull();
    });

    it("pattern_ready handoff: formal patterns surface while early stays silent", () => {
        const patterns = [{
            title: "Chaos check-ins appear repeatedly",
            description: "Chaos check-ins may appear across separate observations.",
            status: "possible",
            evidenceCount: 3,
            lastObservedAt: "2026-09-12T10:00:00Z",
        }];
        const resolved = resolveEarlyUnderstanding({ signals: [chaos(0), chaos(1), chaos(2)], recentMessages: [] });
        expect(resolved.noticeText).toBeNull();

        // Mirror keeps the formal pattern in context — continuity is preserved.
        const context = buildMirrorContext({
            currentMessage: "hello",
            conversation: { title: "t" },
            recentMessages: [],
            recentSignals: [chaos(0)],
            activeMemories: [],
            supportedPatterns: patterns,
            activeExperiments: [],
            relevantLearnings: [],
            preferences: { whatExploring: [], whatToNotice: [] },
            contextSources: [],
            relevantObservations: [],
            earlyUnderstanding: null,
        });
        expect(context.earlyUnderstanding).toBeNull();
        expect(context.supportedPatterns).toHaveLength(1);

        // An early notice covered by the formal pattern is also suppressed.
        const covered = resolveEarlyUnderstanding({
            signals: [chaos(0), chaos(1)],
            recentMessages: [],
            supportedPatterns: patterns,
        });
        expect(covered.noticeText).toBeNull();
        expect(covered.deduplicated).toBe(true);
    });

    it("older evidence still available: Mirror stays bounded at 8, pattern gate sees full history", () => {
        const history = Array.from({ length: 12 }, (_, index) => chaos(index));
        const context = buildMirrorContext({
            currentMessage: "hello",
            conversation: { title: "t" },
            recentMessages: [],
            recentSignals: history,
            activeMemories: [],
            supportedPatterns: [],
            activeExperiments: [],
            relevantLearnings: [],
            preferences: { whatExploring: [], whatToNotice: [] },
            contextSources: [],
            relevantObservations: [],
        });
        // Bounded Mirror reply context is unchanged.
        expect(context.recentSignals).toHaveLength(8);

        // Formal detection uses the full historical list, not the bounded 8:
        // 12x same concept across distinct sources defers to the Pattern Engine.
        const full = assessEarlyUnderstanding(history);
        expect(full.level).toBe("pattern_ready");
        expect(full.signalCount).toBe(12);
        expect(full.distinctSources).toBe(12);
    });
});
