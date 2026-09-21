import { describe, expect, it } from "vitest";

import { crisisResponseFor, crisisResponses } from "./crisis-response.ts";
import { mirrorLanguages } from "./languages.ts";
import { normalizeForRiskMatching, requiresCrisisResponse } from "./safety.ts";

/**
 * One imminent-risk message and one ordinary-distress message per script the
 * product ships. The pair matters more than either half: a detector that fires on
 * everything is as broken as one that fires on nothing, and the failure modes are
 * not symmetric — a miss is caught by the model, a false alarm is not.
 */
const cases: Array<{ language: string; risk: string; ordinary: string }> = [
    { language: "English", risk: "I want to kill myself", ordinary: "Work has been really stressful" },
    { language: "Hindi", risk: "मैं आत्महत्या करना चाहता हूँ", ordinary: "आज बहुत थक गया हूँ" },
    { language: "Hindi", risk: "अब मैं और नहीं जी सकता", ordinary: "कल मीटिंग बहुत लंबी थी" },
    { language: "French", risk: "je veux mourir", ordinary: "je suis fatigué aujourd'hui" },
    { language: "Spanish", risk: "quiero morir", ordinary: "estoy muy cansado hoy" },
    { language: "Chinese", risk: "我不想活了", ordinary: "今天工作很累" },
    { language: "Japanese", risk: "もう死にたい", ordinary: "今日は疲れた" },
    { language: "Korean", risk: "죽고 싶어", ordinary: "오늘 너무 피곤해" },
    { language: "Arabic", risk: "أريد أن أموت", ordinary: "أنا متعب اليوم" },
    { language: "Urdu", risk: "میں خودکشی کرنا چاہتا ہوں", ordinary: "آج بہت تھک گیا ہوں" },
];

describe("immediate risk detection", () => {
    it("recognises imminent risk in every shipped script", () => {
        for (const { language, risk } of cases) {
            expect(requiresCrisisResponse(risk), `${language}: ${risk}`).toBe(true);
        }
    });

    it("leaves ordinary distress alone in every shipped script", () => {
        for (const { language, ordinary } of cases) {
            expect(requiresCrisisResponse(ordinary), `${language}: ${ordinary}`).toBe(false);
        }
    });

    it("does not treat missing-message forms as risk", () => {
        expect(requiresCrisisResponse("")).toBe(false);
        expect(requiresCrisisResponse("   ")).toBe(false);
    });

    it("matches Arabic however the alef and harakat are written", () => {
        // The same sentence, typed four ways: bare alef, hamza, madda, and with
        // full harakat. All four are the same words to a reader.
        const spellings = ["اريد ان اموت", "أريد أن أموت", "آريد ان اموت", "أَرِيدُ أَنْ أَمُوت"];
        for (const spelling of spellings) {
            expect(requiresCrisisResponse(spelling), spelling).toBe(true);
        }
    });

    it("matches Devanagari ज़ across its encodings", () => {
        // Precomposed ज़ (U+095B) is a single codepoint; combining ज + nukta is
        // two; many people type plain ज. All three must detect.
        const spellings = ["ज़हर खा लूँगा", "ज\u093Cहर खा लूँगा", "जहर खा लूँगा"];
        for (const spelling of spellings) {
            expect(requiresCrisisResponse(spelling), spelling).toBe(true);
        }
    });

    it("does not mistake Chinese 想死你了 (I miss you) for a death wish", () => {
        // 想死 on its own is the phrase for missing someone, which is why the
        // Chinese patterns require a subject or intensifier.
        expect(requiresCrisisResponse("好想你，想死你了")).toBe(false);
        expect(requiresCrisisResponse("我想死")).toBe(true);
    });

    it("covers the romanized Hindi and Urdu people actually type", () => {
        for (const message of ["khudkhushi", "khud khushi karunga", "aatmhatya", "jaan de dunga", "marna chahta hun"]) {
            expect(requiresCrisisResponse(message), message).toBe(true);
        }
        expect(requiresCrisisResponse("aaj bahut thak gaya hun")).toBe(false);
    });

    it("normalization is a no-op for Latin messages", () => {
        expect(normalizeForRiskMatching("I want to kill myself.")).toBe("I want to kill myself.");
    });
});

/**
 * The script a language's own text is written in. A translation that was pasted
 * over from English, or left empty, fails here rather than shipping.
 */
const scriptByLanguage: Record<string, RegExp> = {
    hi: /[\u0900-\u097F]/,
    zh: /[\u4E00-\u9FFF]/,
    ja: /[\u3040-\u30FF\u4E00-\u9FFF]/,
    ko: /[\uAC00-\uD7AF]/,
    ar: /[\u0600-\u06FF]/,
    ur: /[\u0600-\u06FF]/,
};

describe("crisis responses", () => {
    it("exists in every language the product offers", () => {
        for (const code of Object.keys(mirrorLanguages)) {
            expect(crisisResponses[code], `${code} has no crisis response`).toBeTruthy();
        }
    });

    it("keeps the reviewed English text byte for byte", () => {
        // The English response is reviewed copy. If this fails, someone changed
        // a safety message without meaning to.
        expect(crisisResponses.en).toBe(
            "I'm really sorry you're dealing with this. If you might act on these thoughts now, contact your local emergency services or crisis line immediately, and reach out to someone you trust who can stay with you. Aks can't provide emergency support.",
        );
    });

    it("every translation is real text in its own script and names Aks", () => {
        // Element 4 of the safety contract is that Aks cannot provide emergency
        // support, and every translation states it, so the product name appears
        // in all of them.
        for (const [code, response] of Object.entries(crisisResponses)) {
            expect(response).toContain("Aks");
            const script = scriptByLanguage[code];
            if (script) expect(script.test(response), `${code} is not written in its own script`).toBe(true);
            if (code !== "en") expect(response, `${code} is still the English text`).not.toBe(crisisResponses.en);
        }
    });

    it("gives a distinct response per language", () => {
        const seen = new Map<string, string>();
        for (const [code, response] of Object.entries(crisisResponses)) {
            const duplicate = seen.get(response);
            expect(duplicate, `${code} duplicates ${duplicate}`).toBeUndefined();
            seen.set(response, code);
        }
    });

    it("falls back to English rather than failing to render", () => {
        for (const value of [null, undefined, "", "klingon"]) {
            expect(crisisResponseFor(value)).toBe(crisisResponses.en);
        }
        expect(crisisResponseFor("hi")).toBe(crisisResponses.hi);
    });
});
