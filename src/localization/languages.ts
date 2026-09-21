import type { Language } from "@/constants/copy";
import { en, type AppCopy, type Translation } from "@/constants/copy";
import ar from "./ar";
import es from "./es";
import fr from "./fr";
import hi from "./hi";
import ja from "./ja";
import ko from "./ko";
import ur from "./ur";
import zh from "./zh";

/**
 * The set of languages the product offers, in display order.
 *
 * A language becomes selectable by having a complete table under
 * `src/localization/<code>.ts` registered here. The `table` field stays
 * optional so the union can list every offered language even before its
 * translation ships — an entry without `table` renders with English copy and
 * shows a "coming soon" hint, instead of pretending to work.
 *
 * `Record<Language, …>` keeps this registry in lockstep with the `Language`
 * union: adding a code to the union fails compilation until a registry entry
 * exists, and an entry without a union member fails the other way.
 */
export const languages: Record<
    Language,
    { code: Language; nativeName: string; englishName: string; dir: "ltr" | "rtl"; table?: Translation }
> = {
    en: { code: "en", nativeName: "English", englishName: "English", dir: "ltr" },
    hi: { code: "hi", nativeName: "हिन्दी", englishName: "Hindi", dir: "ltr", table: hi },
    fr: { code: "fr", nativeName: "Français", englishName: "French", dir: "ltr", table: fr },
    es: { code: "es", nativeName: "Español", englishName: "Spanish", dir: "ltr", table: es },
    zh: { code: "zh", nativeName: "中文", englishName: "Chinese", dir: "ltr", table: zh },
    ja: { code: "ja", nativeName: "日本語", englishName: "Japanese", dir: "ltr", table: ja },
    ko: { code: "ko", nativeName: "한국어", englishName: "Korean", dir: "ltr", table: ko },
    ar: { code: "ar", nativeName: "العربية", englishName: "Arabic", dir: "rtl", table: ar },
    ur: { code: "ur", nativeName: "اردو", englishName: "Urdu", dir: "rtl", table: ur },
};

/** Ordered list for pickers. */
export const languageList: readonly { code: Language; nativeName: string; englishName: string; dir: "ltr" | "rtl"; table?: Translation }[] =
    Object.values(languages);

export type { Language, AppCopy, Translation };

/**
 * The best available translation for a language. Never null: a language
 * without a shipped table resolves to English, the canonical structure.
 */
export function resolveTranslation(code: Language): Translation {
    if (code === "en") return en;
    return languages[code].table ?? en;
}

/** Whether a language has a real translation available right now. */
export function hasTranslation(code: Language): boolean {
    if (code === "en") return true;
    return Boolean(languages[code].table);
}

/** Native display name ("हिन्दी") for pickers. */
export function nativeLanguageName(code: Language): string {
    return languages[code].nativeName;
}

/** Text direction for the language, for RTL-aware layouts. */
export function languageDirection(code: Language): "ltr" | "rtl" {
    return languages[code].dir;
}

/** Default is always English, the canonical structure. */
export const defaultLanguage: Language = "en";
