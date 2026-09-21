import { describe, expect, it } from "vitest";

import { applyLanguage, copy } from "@/constants/copy";
import { mirrorLanguages } from "../../supabase/functions/_shared/mirror/languages";
import {
    defaultLanguage,
    hasTranslation,
    languageDirection,
    languageList,
    languages,
    nativeLanguageName,
    resolveTranslation,
} from "./languages";

describe("language registry", () => {
    it("keeps every definition's code equal to its registry key", () => {
        for (const [code, definition] of Object.entries(languages)) {
            expect(definition.code, `registry key ${code} vs code ${definition.code}`).toBe(code);
        }
    });

    it("orders the picker list deterministically", () => {
        expect(languageList.map((entry) => entry.code)).toEqual([
            "en", "hi", "fr", "es", "zh", "ja", "ko", "ar", "ur",
        ]);
    });

    it("defaults to English, the canonical structure", () => {
        expect(defaultLanguage).toBe("en");
        expect(resolveTranslation("en")).toBe(resolveTranslation("en"));
        expect(hasTranslation("en")).toBe(true);
    });

    it("ships a table for every offered language", () => {
        for (const code of languageList.map((entry) => entry.code)) {
            expect(hasTranslation(code), `${code} has no shipped table`).toBe(true);
        }
    });

    it("resolves every offered language to its own table", () => {
        const seen = new Map<string, string>();
        for (const code of languageList.map((entry) => entry.code)) {
            const header = resolveTranslation(code).language.header;
            expect(header.length, `${code} has an empty language.header`).toBeGreaterThan(0);
            const conflicting = seen.get(header);
            expect(conflicting, `${code} and ${conflicting} share the header "${header}"`).toBeUndefined();
            seen.set(header, code);
        }
    });

    it("falls back to English for a language without a table", () => {
        // Every offered language ships a table now, so exercise the fallback
        // branch by making one temporarily unavailable — the same state a
        // newly added language is in before its translation lands.
        const english = resolveTranslation("en");
        const entry = languages.es;
        const table = entry.table;
        try {
            delete entry.table;
            expect(hasTranslation("es")).toBe(false);
            expect(resolveTranslation("es")).toBe(english);
        } finally {
            entry.table = table;
        }
    });

    it("resolves Hindi to the Hindi table", () => {
        expect(resolveTranslation("hi").language.header).toBe("भाषा");
    });

    it("resolves French to the French table", () => {
        expect(resolveTranslation("fr").language.header).toBe("Langue");
        expect(resolveTranslation("fr").common.tryAgain).toBe("Réessayer");
    });

    it("resolves Spanish to the Spanish table", () => {
        expect(resolveTranslation("es").language.header).toBe("Idioma");
        expect(resolveTranslation("es").common.tryAgain).toBe("Reintentar");
    });

    it("resolves Chinese to the Chinese table", () => {
        expect(resolveTranslation("zh").language.header).toBe("语言");
        expect(resolveTranslation("zh").common.tryAgain).toBe("重试");
        expect(resolveTranslation("zh").brand.tagline).toBe("换一种方式了解自己。");
    });

    it("resolves Japanese to the Japanese table", () => {
        expect(resolveTranslation("ja").language.header).toBe("言語");
        expect(resolveTranslation("ja").common.tryAgain).toBe("もう一度試す");
        expect(resolveTranslation("ja").brand.tagline).toBe("自分を、別の角度から知る。");
    });

    it("resolves Korean to the Korean table", () => {
        expect(resolveTranslation("ko").language.header).toBe("언어");
        expect(resolveTranslation("ko").common.tryAgain).toBe("다시 시도");
        expect(resolveTranslation("ko").brand.tagline).toBe("나를 다른 각도에서 이해하기.");
    });

    it("resolves Arabic to the Arabic table", () => {
        expect(resolveTranslation("ar").language.header).toBe("اللغة");
        expect(resolveTranslation("ar").common.tryAgain).toBe("إعادة المحاولة");
        expect(resolveTranslation("ar").brand.tagline).toBe("افهم نفسك من زاوية أخرى.");
    });

    it("resolves Urdu to the Urdu table", () => {
        expect(resolveTranslation("ur").language.header).toBe("زبان");
        expect(resolveTranslation("ur").common.tryAgain).toBe("دوبارہ کوشش کریں");
        expect(resolveTranslation("ur").brand.tagline).toBe("اپنے آپ کو ایک نئے زاویے سے سمجھیں۔");
    });

    it("keeps the English resolution immune to runtime language switches", () => {
        // resolveTranslation("en") must never hand out the mutable `copy`
        // singleton: applying a language writes into that object, so aliasing
        // it as the English table would make switching back a no-op.
        applyLanguage(resolveTranslation("hi"));
        expect(copy.language.header).toBe("भाषा");
        applyLanguage(resolveTranslation("en"));
        expect(copy.language.header).toBe("Language");
        applyLanguage(resolveTranslation("es"));
        expect(copy.language.header).toBe("Idioma");
        applyLanguage(resolveTranslation("en"));
        expect(copy.language.header).toBe("Language");
        expect(copy.common.version("1.2.3")).toBe("Version 1.2.3");
        // The pristine source of truth is untouched by any of this.
        expect(resolveTranslation("en").language.header).toBe("Language");
    });

    it("offers the same languages to the server as to the app", () => {
        // The Mirror edge function cannot import app code, so it keeps its own
        // map of response languages. Adding or removing a language here without
        // telling the server would leave replies in the wrong language, so the
        // two lists are asserted to match exactly.
        expect(Object.keys(mirrorLanguages).sort()).toEqual(languageList.map((entry) => entry.code).sort());
        // Native names are the user-visible endonyms in the picker; if they
        // diverge, the model is being told to write in a different language
        // than the one the user selected.
        for (const entry of languageList) {
            expect(mirrorLanguages[entry.code].nativeName, `${entry.code} native name`).toBe(entry.nativeName);
        }
    });

    it("exposes native names and directions", () => {
        expect(nativeLanguageName("hi")).toBe("हिन्दी");
        expect(nativeLanguageName("en")).toBe("English");
        expect(languageDirection("ar")).toBe("rtl");
        expect(languageDirection("ur")).toBe("rtl");
        expect(languageDirection("en")).toBe("ltr");
    });
});
