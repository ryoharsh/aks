import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import type { Database } from "@/types/database";

const chunkPrefix = "aks-secure-store-chunks:";
const chunkSize = 1800;

async function removeNativeItem(key: string) {
    const stored = await SecureStore.getItemAsync(key);
    if (stored?.startsWith(chunkPrefix)) {
        const count = Number(stored.slice(chunkPrefix.length));
        await Promise.all(
            Array.from({ length: count }, (_, index) =>
                SecureStore.deleteItemAsync(`${key}.${index}`),
            ),
        );
    }
    await SecureStore.deleteItemAsync(key);
}

const secureStoreAdapter = {
    async getItem(key: string) {
        if (Platform.OS === "web") {
            return globalThis.localStorage?.getItem(key) ?? null;
        }

        const stored = await SecureStore.getItemAsync(key);
        if (!stored?.startsWith(chunkPrefix)) return stored;
        const count = Number(stored.slice(chunkPrefix.length));
        const chunks = await Promise.all(
            Array.from({ length: count }, (_, index) =>
                SecureStore.getItemAsync(`${key}.${index}`),
            ),
        );
        return chunks.every((chunk) => chunk !== null) ? chunks.join("") : null;
    },
    async setItem(key: string, value: string) {
        if (Platform.OS === "web") {
            globalThis.localStorage?.setItem(key, value);
            return;
        }

        await removeNativeItem(key);
        const chunks = value.match(new RegExp(`.{1,${chunkSize}}`, "gs")) ?? [];
        await Promise.all(
            chunks.map((chunk, index) =>
                SecureStore.setItemAsync(`${key}.${index}`, chunk),
            ),
        );
        await SecureStore.setItemAsync(key, `${chunkPrefix}${chunks.length}`);
    },
    async removeItem(key: string) {
        if (Platform.OS === "web") {
            globalThis.localStorage?.removeItem(key);
            return;
        }
        await removeNativeItem(key);
    },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    "placeholder-key";

export const isSupabaseConfigured = Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL &&
    (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
);

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
        storage: secureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: "pkce",
    },
});

if (Platform.OS !== "web") {
    AppState.addEventListener("change", (state) => {
        if (state === "active") supabase.auth.startAutoRefresh();
        else supabase.auth.stopAutoRefresh();
    });
}
