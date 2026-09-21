/**
 * Response languages the Mirror conversation can answer in.
 *
 * The client owns the full translation tables under `src/localization/`. A Deno
 * edge function cannot import app code, so this module mirrors only what the
 * server needs: the *set of codes* the product offers, plus the names handed to
 * the model so it knows which language to write in.
 *
 * `src/localization/languages.test.ts` asserts this list stays exactly in step
 * with the app's `Language` union, so adding or removing a language on the app
 * side fails CI until this module agrees.
 */

export type MirrorLanguage = {
    /** English name, what the model is instructed to write in. */
    englishName: string;
    /** Endonym, used to disambiguate languages with similar English names. */
    nativeName: string;
};

export const mirrorLanguages: Record<string, MirrorLanguage> = {
    en: { englishName: "English", nativeName: "English" },
    hi: { englishName: "Hindi", nativeName: "हिन्दी" },
    fr: { englishName: "French", nativeName: "Français" },
    es: { englishName: "Spanish", nativeName: "Español" },
    zh: { englishName: "Chinese (Simplified)", nativeName: "中文" },
    ja: { englishName: "Japanese", nativeName: "日本語" },
    ko: { englishName: "Korean", nativeName: "한국어" },
    ar: { englishName: "Arabic", nativeName: "العربية" },
    ur: { englishName: "Urdu", nativeName: "اردو" },
};

export const defaultMirrorLanguage = "en";

export type ResolvedResponseLanguage = {
    code: string;
    name: string;
    nativeName: string;
};

/**
 * A client-supplied language code, or null when it is absent or not one the
 * product offers.
 *
 * The client sends the language it is currently displaying, which is more
 * current than the stored preference: a language chosen while offline is
 * applied to the UI (and to the device cache) immediately, but its server sync
 * is best-effort. An unrecognized value is never trusted and never taken as a
 * reason to fall back to English — the caller keeps the stored preference
 * instead.
 */
export function knownResponseLanguage(code: unknown): string | null {
    return typeof code === "string" && mirrorLanguages[code] ? code : null;
}

/**
 * The language the model should answer in, from the user's stored preference.
 *
 * An absent, empty, or unrecognized code resolves to English — the canonical
 * default — rather than failing the turn. A language the user selected before
 * its server entry existed, or a value written by hand into the database, must
 * never be able to break a conversation.
 */
export function resolveResponseLanguage(code: string | null | undefined): ResolvedResponseLanguage {
    const resolved = typeof code === "string" && mirrorLanguages[code] ? code : defaultMirrorLanguage;
    const language = mirrorLanguages[resolved];
    return { code: resolved, name: language.englishName, nativeName: language.nativeName };
}
