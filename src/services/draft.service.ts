import { readLocal, removeLocal, writeLocal } from "./localStore";

/**
 * Local persistence for unsent composer text (spec: drafts stay on this device).
 *
 * A draft is keyed by user + scope so two composers never overwrite each other.
 * Nothing is uploaded, and a draft is cleared the moment it is sent or the user
 * explicitly discards it. Persistence is best-effort: a storage failure must
 * never break typing.
 */
export type DraftScope = "mirror-home" | "mirror-new" | (string & {});

const keyFor = (userId: string, scope: DraftScope) => `aks.draft.${userId}.${scope}`;

export const draftService = {
    async get(userId: string, scope: DraftScope): Promise<string> {
        try {
            return (await readLocal(keyFor(userId, scope))) ?? "";
        } catch {
            return "";
        }
    },

    async set(userId: string, scope: DraftScope, text: string): Promise<void> {
        try {
            if (!text.trim()) {
                await removeLocal(keyFor(userId, scope));
                return;
            }
            await writeLocal(keyFor(userId, scope), text);
        } catch {
            // Draft persistence is a convenience, never a blocker.
        }
    },

    async clear(userId: string, scope: DraftScope): Promise<void> {
        try {
            await removeLocal(keyFor(userId, scope));
        } catch {
            // Nothing to clear.
        }
    },
};
