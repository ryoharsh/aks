import { describe, expect, it } from "vitest";

import { buildMirrorContext } from "./context.ts";
import { validateConversationResponse, validateSignals } from "./validation.ts";
import { requiresCrisisResponse } from "./safety.ts";

describe("Mirror AI validation", () => {
    it("accepts a normalized conversation response", () => {
        expect(validateConversationResponse('{"safety":{"risk":"none"},"response":{"text":"Start with the first small step."},"followUp":null}')).toEqual({
            safety: { risk: "none" },
            response: { text: "Start with the first small step." },
            followUp: null,
        });
    });

    it("rejects responses without a valid safety classification", () => {
        expect(() => validateConversationResponse('{"safety":{"risk":"unknown"},"response":{"text":"Start."},"followUp":null}')).toThrow("INVALID_AI_RESPONSE");
        expect(() => validateConversationResponse('{"response":{"text":"Start."},"followUp":null}')).toThrow("INVALID_AI_RESPONSE");
    });

    it("rejects malformed responses", () => {
        expect(() => validateConversationResponse('{"response":{}}')).toThrow("INVALID_AI_RESPONSE");
        expect(() => validateConversationResponse("not json")).toThrow();
    });

    it("drops unsupported or invalid signals", () => {
        const signals = validateSignals(JSON.stringify({
            signals: [
                { signalType: "difficulty_starting", value: { present: true }, confidence: 0.82 },
                { signalType: "diagnosis", value: { label: "unsupported" }, confidence: 0.9 },
                { signalType: "focus_difficulty", value: { present: true }, confidence: 4 },
                { signalType: "mood_state", value: { state: "low", diagnosis: "unsupported" }, confidence: 0.8 },
            ],
        }));
        expect(signals).toEqual([{ signalType: "difficulty_starting", value: { present: true }, confidence: 0.82 }]);
    });

    it("limits provider context", () => {
        const context = buildMirrorContext({
            currentMessage: "Current",
            conversation: { title: "Title" },
            recentMessages: Array.from({ length: 20 }, (_, index) => ({ role: "user" as const, content: `${index}`, createdAt: `${index}` })),
            recentSignals: Array.from({ length: 12 }, (_, index) => ({ signalType: "focus_difficulty", value: { index }, observedAt: `${index}` })),
            activeMemories: Array.from({ length: 9 }, (_, index) => ({ content: `Memory ${index}`, memoryType: "preference", lastObservedAt: `${index}` })),
            preferences: { whatExploring: [], whatToNotice: [] },
        });
        expect(context.recentMessages).toHaveLength(12);
        expect(context.recentMessages[0].content).toBe("8");
        expect(context.recentSignals).toHaveLength(8);
        expect(context.activeMemories).toHaveLength(6);
    });

    it("detects explicit immediate-risk language without classifying ordinary distress", () => {
        expect(requiresCrisisResponse("I want to kill myself")).toBe(true);
        expect(requiresCrisisResponse("Work has been really stressful")).toBe(false);
    });
});
