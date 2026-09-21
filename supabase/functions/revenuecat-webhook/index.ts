import { createClient } from "npm:@supabase/supabase-js@2";

import {
    buildSubscriptionMirrorRow,
    shouldApplyWebhookEvent,
} from "../_shared/subscription/revenuecat-webhook.ts";

const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const row = buildSubscriptionMirrorRow(rcEvent);
    if (!row) {
        return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200, headers });
    }
    // The client logs in with the Supabase user id; anything else cannot be
    // mapped to a `subscriptions` row.
    if (!uuidPattern.test(row.user_id)) {
        return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200, headers });
    }

    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

    // Stale-event guard: a delayed redelivery must not overwrite newer state.
    // A repeated delivery of the same event carries the same timestamp and
    // the same row, so replays stay idempotent.
    const { data: existing } = await admin
        .from("subscriptions")
        .select("updated_at")
        .eq("user_id", row.user_id)
        .maybeSingle();
    const existingUpdatedAt =
        existing && typeof existing.updated_at === "string"
            ? existing.updated_at
            : null;
    if (!shouldApplyWebhookEvent(existingUpdatedAt, row.updated_at)) {
        return new Response(JSON.stringify({ received: true, ignored: true, reason: "stale" }), { status: 200, headers });
    }

    const { error } = await admin.from("subscriptions").upsert(row, { onConflict: "user_id" });
    if (error) {
        return new Response(JSON.stringify({ error: "Unable to store subscription" }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ received: true, status: row.status }), { status: 200, headers });
});
