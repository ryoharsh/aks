import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Platform-appropriate local storage for small, user-scoped, sensitive values
 * (pending messages, unsent drafts). Native uses SecureStore; web falls back to
 * localStorage. Values are device-local only and never uploaded.
 */
export async function readLocal(key: string): Promise<string | null> {
    return Platform.OS === "web"
        ? globalThis.localStorage?.getItem(key) ?? null
        : SecureStore.getItemAsync(key);
}

export async function writeLocal(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
}

export async function removeLocal(key: string): Promise<void> {
    if (Platform.OS === "web") globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
}
