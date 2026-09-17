import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import type { Session } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { AuthError, type AuthProviderName } from "./auth.types";
import { normalizeAuthError, normalizeEmail, normalizeName } from "./auth.utils";

export const authRedirectUrl = Linking.createURL("auth/callback");

function assertConfigured() {
    if (!isSupabaseConfigured) {
        throw new AuthError(
            "NOT_CONFIGURED",
            "Sign in is not available right now. Please try again later.",
        );
    }
}

function assertWebCryptoAvailable() {
    if (Platform.OS !== "web") return;
    if (typeof globalThis.crypto?.subtle?.digest !== "function") {
        throw new AuthError(
            "WEB_CRYPTO_UNAVAILABLE",
            "Secure WebCrypto isn't available here. Open the web app over HTTPS (or localhost) so sign-in can use SHA-256 PKCE.",
        );
    }
}

async function sendMagicLink(
    email: string,
    options: { shouldCreateUser: boolean; fullName?: string },
) {
    assertConfigured();
    assertWebCryptoAvailable();
    const normalizedEmail = normalizeEmail(email);

    const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
            emailRedirectTo: authRedirectUrl,
            shouldCreateUser: options.shouldCreateUser,
            data: options.fullName
                ? { full_name: options.fullName.trim() }
                : undefined,
        },
    });

    if (error) throw normalizeAuthError(error);
}

const callbackExchanges = new Map<string, Promise<Session | null>>();

async function exchangeAuthCallbackOnce(url: string): Promise<Session | null> {
    const callbackUrl = new URL(url);
    const expectedUrl = new URL(authRedirectUrl);
    if (
        callbackUrl.protocol !== expectedUrl.protocol ||
        callbackUrl.host !== expectedUrl.host ||
        callbackUrl.pathname !== expectedUrl.pathname
    ) return null;

    const callbackError = callbackUrl.searchParams.get("error_description");
    if (callbackError) throw normalizeAuthError(new Error(callbackError));

    const code = callbackUrl.searchParams.get("code");
    if (code) {
        assertWebCryptoAvailable();
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw normalizeAuthError(error);
        return data.session;
    }

    return null;
}

function exchangeAuthCallback(url: string): Promise<Session | null> {
    const existing = callbackExchanges.get(url);
    if (existing) return existing;
    const exchange = exchangeAuthCallbackOnce(url).catch((error) => {
        throw error;
    });
    callbackExchanges.set(url, exchange);
    void exchange.then(
        () => callbackExchanges.delete(url),
        () => callbackExchanges.delete(url),
    );
    return exchange;
}

export const authService = {
    async signInWithMagicLink(email: string) {
        await sendMagicLink(email, { shouldCreateUser: false });
    },

    async signUpWithMagicLink(fullName: string, email: string) {
        const normalizedName = normalizeName(fullName);
        await sendMagicLink(email, {
            shouldCreateUser: true,
            fullName: normalizedName,
        });
    },

    async signInWithProvider(provider: AuthProviderName) {
        assertConfigured();
        assertWebCryptoAvailable();
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: authRedirectUrl,
                skipBrowserRedirect: true,
            },
        });

        if (error) throw normalizeAuthError(error);
        if (!data.url) throw new AuthError("UNKNOWN", "We couldn't start sign in.");

        const result = await WebBrowser.openAuthSessionAsync(data.url, authRedirectUrl);
        if (result.type !== "success") {
            throw new AuthError("OAUTH_CANCELLED", "Sign in was cancelled.");
        }
        await exchangeAuthCallback(result.url);
    },

    async getSession() {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw normalizeAuthError(error);
        return data.session;
    },

    async getUser() {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw normalizeAuthError(error);
        return data.user;
    },

    onAuthStateChange(callback: (session: Session | null) => void) {
        return supabase.auth.onAuthStateChange((_event, session) => callback(session));
    },

    exchangeAuthCallback,

    async updateName(fullName: string) {
        const normalizedName = fullName.trim();
        if (normalizedName.length < 2) {
            throw new AuthError("UNKNOWN", "Please enter your full name.");
        }
        const { data, error } = await supabase.auth.updateUser({
            data: { full_name: normalizedName },
        });
        if (error) throw normalizeAuthError(error);
        return data.user;
    },

    async updateAvatar(avatarUrl: string | null) {
        const { data, error } = await supabase.auth.updateUser({
            data: { avatar_url: avatarUrl },
        });
        if (error) throw normalizeAuthError(error);
        return data.user;
    },

    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw normalizeAuthError(error);
    },
};

WebBrowser.maybeCompleteAuthSession();
