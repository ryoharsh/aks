import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { applyLanguage, copy } from "@/constants/copy";
import { useAuth } from "@/hooks/useAuth";
import {
    defaultLanguage,
    hasTranslation,
    languageDirection,
    languageList,
    nativeLanguageName,
    resolveTranslation,
    type Language,
} from "@/localization/languages";
import { languageService } from "@/services/language.service";
import { usePreferences } from "@/providers/PreferencesProvider";

type LanguageContextValue = {
    /** The active language code. */
    language: Language;
    /** Whether the persisted choice (or fallback) has been loaded. */
    ready: boolean;
    /** Ordered language definitions for pickers, with availability resolved. */
    languages: readonly { code: Language; nativeName: string; englishName: string; dir: "ltr" | "rtl"; available: boolean }[];
    /** Native name of the active language, for the Settings/Profile rows. */
    currentNativeName: string;
    /** Text direction of the active language. */
    direction: "ltr" | "rtl";
    /**
     * Switch the active language. Returns an error string when the choice is
     * unavailable (no translation shipped yet), null on success. The switch
     * applies instantly across the app.
     */
    selectLanguage: (code: Language) => Promise<string | null>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Makes `copy` language-aware.
 *
 * `copy` is a module singleton swapped by `applyLanguage`, so all existing
 * `copy.*` call sites keep working unchanged. Components read the context
 * value to learn the active language; the provider re-renders its subtree on
 * every switch so screens re-read `copy` with the new table in place.
 *
 * Resolution order: the device cache applies immediately, then the account's
 * server-side choice (`user_preferences.language`) decides. A server choice
 * that differs from the device cache wins — so a language picked on another
 * device follows the user — and is written back into the device cache. With
 * no server choice yet, the device choice stands and is pushed to the server
 * on the next explicit selection. Everything falls back to English, the
 * canonical structure, when nothing is stored.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const { preferences, updatePreferences } = usePreferences();
    const [language, setLanguage] = useState<Language>(defaultLanguage);
    const [ready, setReady] = useState(false);
    const requestId = useRef(0);
    const serverLanguage = preferences.language;

    useEffect(() => {
        const currentRequest = ++requestId.current;
        let active = true;
        void (async () => {
            // Device cache: instant, avoids flashing the default language
            // while the server preference round-trips.
            const device = user ? await languageService.get(user.id).catch(() => null) : null;
            if (!active || currentRequest !== requestId.current) return;
            if (!serverLanguage) {
                const initial = device ?? defaultLanguage;
                applyLanguage(resolveTranslation(initial));
                setLanguage(initial);
                setReady(true);
                return;
            }
            // The account's choice wins over this device's cache.
            if (serverLanguage !== device && user) void languageService.set(user.id, serverLanguage);
            applyLanguage(resolveTranslation(serverLanguage));
            setLanguage(serverLanguage);
            setReady(true);
        })();
        return () => {
            active = false;
        };
    }, [user?.id, serverLanguage]);

    const selectLanguage = useCallback(
        async (code: Language): Promise<string | null> => {
            if (!hasTranslation(code)) {
                return copy.language.notAvailableYet(nativeLanguageName(code));
            }
            applyLanguage(resolveTranslation(code));
            setLanguage(code);
            if (user) {
                // Device cache first: the choice survives even if the server
                // write fails, and the next successful preferences write
                // carries the language up.
                await languageService.set(user.id, code);
                try {
                    await updatePreferences({ language: code });
                } catch {
                    // Server sync is best-effort; the language is applied.
                }
            }
            return null;
        },
        [user, updatePreferences],
    );

    const value = useMemo<LanguageContextValue>(
        () => ({
            language,
            ready,
            languages: languageList.map((entry) => ({
                code: entry.code,
                nativeName: entry.nativeName,
                englishName: entry.englishName,
                dir: entry.dir,
                available: hasTranslation(entry.code),
            })),
            currentNativeName: nativeLanguageName(language),
            direction: languageDirection(language),
            selectLanguage,
        }),
        [language, ready, selectLanguage],
    );

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
    const context = useContext(LanguageContext);
    if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
    return context;
}
