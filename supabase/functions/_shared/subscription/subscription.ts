// Server-side subscription verification for Supabase Edge Functions.
//
// The client NEVER authorizes: every protected function checks the
// `public.subscriptions` mirror (written only by the RevenueCat webhook via
// service role) after authenticating the user. Access mirrors the client
// rule — the `premium` entitlement is active — expressed through the mirror
// row: `active` always allows; `cancelled`/`billing_issue` allow only while
// the current period has not expired (cancelled users keep access until the
// entitlement actually lapses); everything else denies.
//
// Intentionally dependency-free (no `npm:` imports) so this module runs
// under both Deno (Edge Functions) and vitest.

export const SUBSCRIPTION_REQUIRED_CODE = "SUBSCRIPTION_REQUIRED";
export const SUBSCRIPTION_REQUIRED_MESSAGE =
    "An active Aks subscription is required.";

export type SubscriptionRow = {
    user_id: string;
    status: string | null;
    expires_at: string | null;
    updated_at?: string | null;
};

// Structural minimum of the supabase-js admin client. `from()` is typed as
// `any` so both the real client (Deno) and lightweight fakes (vitest) fit
// without casts.
export type SubscriptionAdminClient = {
    from(table: string): any;
};

export function isSubscriptionRowActive(
    row: SubscriptionRow | null,
    nowMs: number = Date.now(),
): boolean {
    if (!row) {
        return false;
    }
    const status = (row.status ?? "").trim().toLowerCase();
    if (status === "active") {
        return true;
    }
    if (status === "cancelled" || status === "billing_issue") {
        // Grace: a cancelled subscription stays usable until the paid period
        // ends; a billing issue stays usable while the store grace period
        // (or an unknown expiry) still covers the user.
        if (!row.expires_at) {
            return status === "billing_issue";
        }
        const expiresMs = Date.parse(row.expires_at);
        if (Number.isNaN(expiresMs)) {
            return false;
        }
        return expiresMs > nowMs;
    }
    return false;
}

export type SubscriptionCheck =
    | { ok: true }
    | { ok: false; code: string; message: string };

const denied = (): SubscriptionCheck => ({
    ok: false,
    code: SUBSCRIPTION_REQUIRED_CODE,
    message: SUBSCRIPTION_REQUIRED_MESSAGE,
});

/**
 * Development bypass, scoped to explicit test accounts.
 *
 * When the Edge Function env sets AKS_DEV_BYPASS_USER_IDS to a
 * comma-separated list of auth user ids, ONLY those users skip the
 * subscription check. This mirrors the client-side SUBSCRIPTION_DEV_BYPASS
 * so a development build works end to end with no Premium account.
 *
 * Deliberately per-user instead of project-wide: even with the secret set,
 * every other user still follows the normal subscriptions-mirror check, so
 * enabling it can never grant Premium to real users.
 */
function devBypassUserIds(): Set<string> {
    try {
        const deno = (globalThis as { Deno?: { env: { get(key: string): string | undefined } } }).Deno;
        const raw = deno?.env.get("AKS_DEV_BYPASS_USER_IDS") ?? "";
        return new Set(raw.split(",").map((id) => id.trim()).filter(Boolean));
    } catch {
        return new Set();
    }
}

/**
 * Global subscriptions kill-switch, read from the Edge Function env.
 *
 * Single shared variable with the client
 * (EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED): enabled by default and only disabled
 * by the explicit string "false" — any other value (including a typo or a
 * missing variable) keeps every subscription gate closed. Set it to "false"
 * to run the app without limitations; set it back to anything else to
 * re-enable billing.
 */
function subscriptionsEnabled(): boolean {
    try {
        const deno = (globalThis as { Deno?: { env: { get(key: string): string | undefined } } }).Deno;
        return deno?.env.get("EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED") !== "false";
    } catch {
        return true;
    }
}

/**
 * Verify the caller's subscription from the server-side mirror.
 * Fails closed: missing rows, query errors, and unknown states all deny.
 */
export async function requireActiveSubscription(
    admin: SubscriptionAdminClient,
    userId: string,
    nowMs: number = Date.now(),
): Promise<SubscriptionCheck> {
    if (!subscriptionsEnabled()) {
        return { ok: true };
    }
    if (devBypassUserIds().has(userId)) {
        return { ok: true };
    }
    try {
        const { data, error } = await admin
            .from("subscriptions")
            .select("user_id,status,expires_at")
            .eq("user_id", userId)
            .maybeSingle();
        if (error || !isSubscriptionRowActive(data, nowMs)) {
            return denied();
        }
        return { ok: true };
    } catch {
        return denied();
    }
}
