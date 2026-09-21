import { Linking } from "react-native";

import { supabase, supabaseUrl, assertSupabaseConfigured } from "@/lib/supabase";
import { requireAuthenticatedUser, throwDataError } from "@/repositories/data.repository";
import { copy } from "@/constants/copy";

const supabaseAnonKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    "";

/**
 * External provider account links (Google, Notion, GitHub, Slack, Todoist...).
 * The client only ever starts the OAuth flow and records the link state;
 * access/refresh tokens are exchanged and stored server-side by the
 * `source-oauth-callback` Edge Function, never inside the app.
 */

export const OAUTH_SOURCE_NAMES: Record<string, string> = {
    google_calendar: copy.oauth.googleCalendar,
    google_tasks: copy.oauth.googleTasks,
    notion: copy.oauth.notion,
    todoist: copy.oauth.todoist,
    github: copy.oauth.github,
    slack: copy.oauth.slack,
    email: copy.oauth.email,
};

let pendingSource: string | null = null;
const listeners = new Set<(sourceType: string) => void>();

function parseCallback(url: string): { source: string; status: string; label: string } | null {
    try {
        if (!url.startsWith("aks://source-callback")) return null;
        const query = url.split("?")[1] ?? "";
        const params = new URLSearchParams(query);
        const source = params.get("source");
        const status = params.get("status") ?? "";
        if (!source || !OAUTH_SOURCE_NAMES[source]) return null;
        if (!["connected", "error", "revoked"].includes(status)) return null;
        return { source, status, label: (params.get("label") ?? "").slice(0, 120) };
    } catch {
        return null;
    }
}

async function handleCallbackUrl(url: string): Promise<boolean> {
    const payload = parseCallback(url);
    if (!payload) return false;
    if (pendingSource && payload.source !== pendingSource) return false;
    const user = await requireAuthenticatedUser().catch(() => null);
    if (!user) return false;
    const { error } = await supabase
        .from("user_source_accounts")
        .upsert({
            user_id: user.id,
            source_type: payload.source,
            status: payload.status as "connected" | "error" | "revoked",
            provider_account_label: payload.label,
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,source_type" });
    if (error) throwDataError(error, copy.errors.oauthRecord);
    pendingSource = null;
    for (const listener of listeners) listener(payload.source);
    return true;
}

export const oauthSourceLinks = {
    /** Begin connecting an external provider. Returns false if misconfigured. */
    async connect(sourceType: string): Promise<boolean> {
        if (!OAUTH_SOURCE_NAMES[sourceType]) return false;
        try {
            assertSupabaseConfigured();
        } catch {
            return false;
        }
        await requireAuthenticatedUser();
        pendingSource = sourceType;
        try {
            // Ask the backend for a signed authorize URL (state = userId.sourceType.HMAC).
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            if (!token) return false;
            const functionsUrl = supabaseUrl.replace(/\/$/, "") + "/functions/v1";
            const response = await fetch(`${functionsUrl}/source-oauth-start`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey, "Content-Type": "application/json" },
                body: JSON.stringify({ sourceType }),
            });
            if (!response.ok) {
                pendingSource = null;
                return false;
            }
            const payload = (await response.json()) as { authorizeUrl?: string };
            if (!payload.authorizeUrl) {
                pendingSource = null;
                return false;
            }
            await Linking.openURL(payload.authorizeUrl);
            return true;
        } catch {
            pendingSource = null;
            return false;
        }
    },

    async disconnect(sourceType: string): Promise<void> {
        const user = await requireAuthenticatedUser();
        const { error } = await supabase
            .from("user_source_accounts")
            .delete()
            .eq("user_id", user.id)
            .eq("source_type", sourceType);
        if (error) throwDataError(error, copy.errors.oauthDisconnect);
    },

    async isLinked(sourceType: string): Promise<boolean> {
        const user = await requireAuthenticatedUser();
        const { data, error } = await supabase
            .from("user_source_accounts")
            .select("status")
            .eq("user_id", user.id)
            .eq("source_type", sourceType)
            .maybeSingle();
        if (error) return false;
        return (data as { status: string } | null)?.status === "connected";
    },

    /** Register deep-link listeners; returns an unsubscribe function. */
    addListener(listener: (sourceType: string) => void): () => void {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },

    /** Called once from the app lifecycle to catch cold-start callbacks. */
    async handleInitialUrl(): Promise<void> {
        const initial = await Linking.getInitialURL().catch(() => null);
        if (initial) await handleCallbackUrl(initial).catch(() => undefined);
        const unsubscribe = Linking.addEventListener("url", (event) => {
            void handleCallbackUrl(event.url).catch(() => undefined);
        });
        liveUnsubscribe = () => unsubscribe.remove();
    },
};

let liveUnsubscribe: (() => void) | null = null;
export function stopOAuthListeners(): void {
    liveUnsubscribe?.();
    liveUnsubscribe = null;
}

/** Shallow check used by the permission manager (never throws). */
export async function isOAuthSourceLinked(sourceType: string): Promise<boolean> {
    return oauthSourceLinks.isLinked(sourceType);
}
