import { createClient } from "npm:@supabase/supabase-js@2";

import { claimDelivery, processDelivery, type DeliveryRow } from "../_shared/notifications/engine.ts";
import { resolveOneSignalConfig } from "../_shared/notifications/onesignal.client.ts";

const headers = { "Content-Type": "application/json" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

type NotifyRequest = {
    userId?: unknown;
    category?: unknown;
    sourceType?: unknown;
    sourceId?: unknown;
    eventKey?: unknown;
    title?: unknown;
    body?: unknown;
    route?: unknown;
    timezone?: unknown;
};

const categories = new Set(["insights", "experiments", "checkIns", "weekly"]);
const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: { ...headers, "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
    if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);

    // Service-role only: this function is callable from trusted server code
    // (database webhooks/triggers via pg_net or other Edge Functions), never
    // from clients with anon/authenticated keys.
    const apiKey = request.headers.get("apikey") ?? "";
    const configuredServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!configuredServiceKey || apiKey !== configuredServiceKey) {
        return respond({ error: { code: "UNAUTHORIZED" } }, 401);
    }

    const oneSignal = resolveOneSignalConfig(Deno.env);
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!oneSignal || !url || !serviceRoleKey) return respond({ error: { code: "NOT_CONFIGURED" } }, 503);

    const payload = await request.json().catch(() => null) as NotifyRequest | null;
    const userId = typeof payload?.userId === "string" && validUuid.test(payload.userId) ? payload.userId : null;
    const category = typeof payload?.category === "string" && categories.has(payload.category) ? payload.category : null;
    const eventKey = typeof payload?.eventKey === "string" ? payload.eventKey.trim() : "";
    const title = typeof payload?.title === "string" ? payload.title.trim().slice(0, 160) : "";
    const body = typeof payload?.body === "string" ? payload.body.trim().slice(0, 300) : "";
    const route = typeof payload?.route === "string" && payload.route.length <= 120 ? payload.route : null;
    const timezone = typeof payload?.timezone === "string" ? payload.timezone : null;
    const sourceId = typeof payload?.sourceId === "string" && validUuid.test(payload.sourceId) ? payload.sourceId : null;
    if (!userId || !category || eventKey.length < 3 || eventKey.length > 200 || !title || !body) {
        return respond({ error: { code: "INVALID_REQUEST" } }, 400);
    }

    try {
        const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
        const claim = await claimDelivery(adminClient, {
            userId,
            category: category as DeliveryRow["category"],
            sourceType: typeof payload?.sourceType === "string" && payload.sourceType.length <= 60 ? payload.sourceType : "system",
            sourceId,
            eventKey,
            title,
            body,
            route,
            timezone,
        });
        if (claim.status !== "claimed" && claim.status !== "retry") {
            return respond({ status: claim.status, reason: claim.reason ?? null, deliveryId: claim.deliveryId });
        }

        const { data: row } = await adminClient.from("notification_deliveries").select("*").eq("id", claim.deliveryId!).maybeSingle();
        if (!row) return respond({ error: { code: "DELIVERY_UNAVAILABLE" } }, 500);

        const outcome = await processDelivery({ adminClient, oneSignal }, row as DeliveryRow);
        return respond({ status: outcome.outcome, deliveryId: outcome.deliveryId, detail: outcome.detail ?? null });
    } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 200) : "unexpected";
        return respond({ error: { code: "SEND_FAILED", message } }, 500);
    }
});
