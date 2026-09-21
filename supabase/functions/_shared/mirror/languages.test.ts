import { describe, expect, it } from "vitest";

import { buildMirrorContext } from "./context.ts";
import { defaultMirrorLanguage, mirrorLanguages, resolveResponseLanguage } from "./languages.ts";
import { conversationResponseTask } from "./prompts.ts";

function contextFor(language: string | null | undefined) {
    return buildMirrorContext({
        currentMessage: "Current",
        conversation: { title: "Title" },
        recentMessages: [],
        recentSignals: [],
        activeMemories: [],
        supportedPatterns: [],
        activeExperiments: [],
        relevantLearnings: [],
        preferences: { whatExploring: [], whatToNotice: [], language },
        contextSources: [],
        relevantObservations: [],
    });
}

describe("response language", () => {
    it("resolves a stored code to the language the model is told to write in", () => {
        expect(resolveResponseLanguage("hi")).toEqual({ code: "hi", name: "Hindi", nativeName: "हिन्दी" });
        expect(resolveResponseLanguage("ja")).toEqual({ code: "ja", name: "Japanese", nativeName: "日本語" });
        expect(resolveResponseLanguage("ur")).toEqual({ code: "ur", name: "Urdu", nativeName: "اردو" });
    });

    it("defaults to English rather than failing the turn", () => {
        // No stored choice yet, a cleared value, and a value that was written
        // by hand (or belongs to a language that was later removed) must all
        // degrade to the canonical default instead of breaking a conversation.
        for (const value of [null, undefined, "", "klingon", "EN", "Hindi"]) {
            expect(resolveResponseLanguage(value).code, JSON.stringify(value)).toBe(defaultMirrorLanguage);
        }
        expect(resolveResponseLanguage(null).name).toBe("English");
    });

    it("offers every language with both an English and a native name", () => {
        for (const [code, language] of Object.entries(mirrorLanguages)) {
            expect(language.englishName.length, `${code} has no English name`).toBeGreaterThan(0);
            expect(language.nativeName.length, `${code} has no native name`).toBeGreaterThan(0);
        }
    });
});

describe("mirror context carries the response language", () => {
    it("surfaces the user's stored language to the model", () => {
        expect(contextFor("hi").responseLanguage).toEqual({ code: "hi", name: "Hindi", nativeName: "हिन्दी" });
    });

    it("defaults to English when preferences carry no language", () => {
        expect(contextFor(null).responseLanguage.code).toBe("en");
        expect(contextFor(undefined).responseLanguage.code).toBe("en");
    });

    it("keeps the language out of preferences", () => {
        // The instructions forbid treating preferences as evidence; the reply
        // language is an instruction about the reply, not something to reason
        // about, so it must not be folded into them.
        expect(contextFor("ar").preferences).toEqual({ whatExploring: [], whatToNotice: [] });
    });

    it("keeps the prompt and the context field named together", () => {
        // The rule lives in the static system prompt and the value in the
        // context JSON. Renaming one side without the other would silently
        // drop the language instruction, so both are asserted here.
        const field = "responseLanguage";
        expect(Object.keys(contextFor("fr"))).toContain(field);
        expect(conversationResponseTask.instructions).toContain(field);
    });
});
