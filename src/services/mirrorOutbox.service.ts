import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { Json } from "@/types/database";

export type MirrorOutboxItem = {
    requestId: string;
    conversationId: string | null;
    content: string;
    metadata: Json;
    createdAt: string;
};

const keyFor = (userId: string) => `aks.mirror.pending.${userId}`;

async function read(key: string) {
    return Platform.OS === "web"
        ? globalThis.localStorage?.getItem(key) ?? null
        : SecureStore.getItemAsync(key);
}

async function write(key: string, value: string) {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
}

async function remove(key: string) {
    if (Platform.OS === "web") globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
}

export const mirrorOutboxService = {
    async get(userId: string): Promise<MirrorOutboxItem | null> {
        const value = await read(keyFor(userId));
        if (!value) return null;
        try {
            const item = JSON.parse(value) as MirrorOutboxItem;
            if (Date.now() - new Date(item.createdAt).getTime() > 24 * 60 * 60 * 1000) {
                await remove(keyFor(userId));
                return null;
            }
            return item;
        } catch {
            await remove(keyFor(userId));
            return null;
        }
    },
    set(userId: string, item: MirrorOutboxItem) {
        return write(keyFor(userId), JSON.stringify(item));
    },
    clear(userId: string) {
        return remove(keyFor(userId));
    },
};
