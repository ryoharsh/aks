import type { Language } from "@/localization/languages";

import { readLocal, removeLocal, writeLocal } from "./localStore";

/**
 * Device-local persistence for the chosen display language.
 *
 * Stored per user so two accounts on one device keep their own language.
 * Storage is best-effort: a failure must never block rendering, so every
 * accessor returns null (meaning "no explicit choice — use the default")
 * instead of throwing.
 */
const keyFor = (userId: string) => `aks.language.${userId}`;

const KNOWN_CODES: readonly Language[] = ["en", "hi", "fr", "es", "zh", "ja", "ko", "ar", "ur"];

function isLanguageCode(value: string | null): value is Language {
    return value !== null && (KNOWN_CODES as readonly string[]).includes(value);
}

export const languageService = {
    /** The persisted language, or null when no explicit choice is stored. */
    async get(userId: string): Promise<Language | null> {
        try {
            const stored = await readLocal(keyFor(userId));
            return isLanguageCode(stored) ? stored : null;
        } catch {
            return null;
        }
    },

    /** Best-effort persist; failures are silent by design. */
    async set(userId: string, language: Language): Promise<void> {
        try {
            await writeLocal(keyFor(userId), language);
        } catch {
            // Preference persistence is a convenience, never a blocker.
        }
    },

    /** Remove the stored choice (e.g. sign-out hygiene). */
    async clear(userId: string): Promise<void> {
        try {
            await removeLocal(keyFor(userId));
        } catch {
            // Nothing to clear.
        }
    },
};
