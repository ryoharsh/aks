import type { Json } from "@/types/database";
import { readLocal, removeLocal, writeLocal } from "./localStore";

export type MirrorOutboxItem = {
    requestId: string;
    conversationId: string | null;
    content: string;
    metadata: Json;
    createdAt: string;
};

const keyFor = (userId: string) => `aks.mirror.pending.${userId}`;

export const mirrorOutboxService = {
    async get(userId: string): Promise<MirrorOutboxItem | null> {
        const value = await readLocal(keyFor(userId));
        if (!value) return null;
        try {
            const item = JSON.parse(value) as MirrorOutboxItem;
            if (Date.now() - new Date(item.createdAt).getTime() > 24 * 60 * 60 * 1000) {
                await removeLocal(keyFor(userId));
                return null;
            }
            return item;
        } catch {
            await removeLocal(keyFor(userId));
            return null;
        }
    },
    set(userId: string, item: MirrorOutboxItem) {
        return writeLocal(keyFor(userId), JSON.stringify(item));
    },
    clear(userId: string) {
        return removeLocal(keyFor(userId));
    },
};
