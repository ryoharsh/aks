import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { Provider } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabase } from "./supabase";

export const authRedirectUrl = Linking.createURL("auth/callback");

function assertSupabaseConfigured() {
    if (!isSupabaseConfigured) {
        throw new Error(
            "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.",
        );
    }
}

export async function sendMagicLink(
    email: string,
    options?: { shouldCreateUser?: boolean; fullName?: string },
) {
    assertSupabaseConfigured();

    return supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
            emailRedirectTo: authRedirectUrl,
            shouldCreateUser: options?.shouldCreateUser ?? true,
            data: options?.fullName
                ? { full_name: options.fullName.trim() }
                : undefined,
        },
    });
}

export async function signInWithProvider(provider: Provider) {
    assertSupabaseConfigured();

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: authRedirectUrl,
            skipBrowserRedirect: true,
        },
    });

    if (error) {
        return { data: null, error };
    }

    if (!data.url) {
        return {
            data: null,
            error: new Error("Supabase did not return an OAuth URL."),
        };
    }

    const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        authRedirectUrl,
    );

    if (result.type !== "success") {
        return { data: null, error: new Error("OAuth sign-in was cancelled.") };
    }

    const callbackUrl = new URL(result.url);
    const code = callbackUrl.searchParams.get("code");

    if (!code) {
        return {
            data: null,
            error: new Error("OAuth callback did not include an auth code."),
        };
    }

    return supabase.auth.exchangeCodeForSession(code);
}

export async function exchangeAuthCallback(url: string) {
    const callbackUrl = new URL(url);
    const code = callbackUrl.searchParams.get("code");

    if (!code) {
        return { data: null, error: null };
    }

    return supabase.auth.exchangeCodeForSession(code);
}
