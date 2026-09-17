import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
};

const DEFAULT_ENTITLEMENT = "premium";

const eventToStatus: Record<string, string> = {
    INITIAL_PURCHASE: "active",
    RENEWAL: "active",
    PRODUCT_CHANGE: "active",
    UNCANCELLATION: "active",
    NON_RENEWING_PURCHASE: "active",
    TRIAL_STARTED: "active",
    TRIAL_CONVERTED: "active",
    TRANSFER: "active",
    CANCELLATION: "cancelled",
    SUBSCRIPTION_PAUSED: "cancelled",
    BILLING_ISSUE: "billing_issue",
    EXPIRATION: "expired",
    REFUND: "expired",
};

function equalSecrets(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers });
    if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
    }

    const authorization = request.headers.get("Authorization");
    const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
    if (!webhookSecret || !authorization?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }
    const token = authorization.slice("Bearer ".length);
    if (!equalSecrets(token, webhookSecret)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) {
        return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500, headers });
    }

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400, headers });
    }

    const rcEvent = (body.event ?? body) as Record<string, unknown>;
    const eventType = typeof rcEvent.type === "string" ? rcEvent.type : "";
    const status = eventToStatus[eventType];
    const appUserId = typeof rcEvent.app_user_id === "string" ? rcEvent.app_user_id : "";

    if (!status || !appUserId) {
        return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200, headers });
    }

    const entitlementIds = Array.isArray(rcEvent.entitlement_ids)
        ? rcEvent.entitlement_ids.filter((id): id is string => typeof id === "string")
        : [];
    const productId = typeof rcEvent.product_id === "string" ? rcEvent.product_id : null;
    const expirationAtMs = typeof rcEvent.expiration_at_ms === "number" ? rcEvent.expiration_at_ms : null;
    // Store the Supabase user id as the RevenueCat customer id: the client logs in
    // with the user id, so revenuecat_customer_id and user_id match.
    const row = {
        user_id: appUserId,
        revenuecat_customer_id: appUserId,
        entitlement: entitlementIds[0] ?? DEFAULT_ENTITLEMENT,
        product_id: productId,
        status,
        expires_at: expirationAtMs ? new Date(expirationAtMs).toISOString() : null,
        updated_at: new Date().toISOString(),
    };

    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const { error } = await admin.from("subscriptions").upsert(row, { onConflict: "user_id" });
    if (error) {
        return new Response(JSON.stringify({ error: "Unable to store subscription" }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ received: true, status }), { status: 200, headers });
});