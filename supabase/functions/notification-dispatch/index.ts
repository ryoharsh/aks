import { createClient } from "npm:@supabase/supabase-js@2";

import { processDelivery, type DeliveryRow } from "../_shared/notifications/engine.ts";
import { resolveOneSignalConfig } from "../_shared/notifications/onesignal.client.ts";

const headers = { "Content-Type": "application/json" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

type DueRow = DeliveryRow & { send_after: string | null; scheduled_for: string | null };

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers });
    if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);

    const apiKey = request.headers.get("apikey") ?? "";
    const configuredServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = request.headers.get("Authorization") ?? "";
    const isServiceRole = apiKey === configuredServiceKey || authHeader === `Bearer ${configuredServiceKey}`;
    if (!configuredServiceKey || !isServiceRole) return respond({ error: { code: "UNAUTHORIZED" } }, 401);

    const oneSignal = resolveOneSignalConfig(Deno.env);
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) return respond({ error: { code: "NOT_CONFIGURED" } }, 503);

    const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const nowIso = new Date().toISOString();
    const results: Array<{ id: string; outcome: string; detail?: string | null }> = [];

    try {
        // 1. Due scheduled sends (send_after passed, not already being sent).
        const { data: dueRows, error: dueError } = await adminClient
            .from("notification_deliveries")
            .select("*")
            .eq("status", "scheduled")
            .or(`send_after.is.null,send_after.lte.${nowIso}`)
            .order("scheduled_for", { ascending: true })
            .limit(25);
        if (dueError) throw new Error(dueError.message);

        // Atomically flip each to 'sending' so parallel cron invocations skip it.
        for (const row of dueRows ?? []) {
            const { data: claimed } = await adminClient
                .from("notification_deliveries")
                .update({ status: "sending", updated_at: nowIso })
                .eq("id", (row as DeliveryRow).id)
                .eq("status", "scheduled")
                .select("id");
            if (!claimed || claimed.length === 0) continue;
            if (oneSignal) {
                const outcome = await processDelivery({ adminClient, oneSignal }, { ...row, status: "scheduled" } as DeliveryRow);
                results.push({ id: (row as DeliveryRow).id, outcome: outcome.outcome, detail: outcome.detail ?? null });
            } else {
                // No OneSignal credentials configured: park as failed with reason.
                await adminClient.from("notification_deliveries").update({ status: "failed", failure_reason: "onesignal_not_configured", updated_at: nowIso }).eq("id", (row as DeliveryRow).id);
                results.push({ id: (row as DeliveryRow).id, outcome: "failed", detail: "onesignal_not_configured" });
            }
        }

        // 2. Retryable failures whose backoff elapsed.
        if (oneSignal) {
            const { data: failedRows } = await adminClient
                .from("notification_deliveries")
                .select("*")
                .eq("status", "failed")
                .lt("attempt_count", 3)
                .lt("updated_at", new Date(Date.now() - 5 * 60000).toISOString())
                .order("updated_at", { ascending: true })
                .limit(10);
            for (const row of failedRows ?? []) {
                const { data: claimed } = await adminClient
                    .from("notification_deliveries")
                    .update({ status: "sending", updated_at: nowIso })
                    .eq("id", (row as DeliveryRow).id)
                    .eq("status", "failed")
                    .select("id");
                if (!claimed || claimed.length === 0) continue;
                const outcome = await processDelivery({ adminClient, oneSignal }, { ...row, status: "failed" } as DeliveryRow);
                results.push({ id: (row as DeliveryRow).id, outcome: outcome.outcome, detail: outcome.detail ?? null });
            }
        }

        // 3. Expire stale scheduled rows (past expires_at, still unsent).
        const { data: expired } = await adminClient
            .from("notification_deliveries")
            .update({ status: "expired", failure_reason: "expired", updated_at: nowIso })
            .eq("status", "scheduled")
            .lt("expires_at", nowIso)
            .select("id");
        for (const row of expired ?? []) {
            results.push({ id: (row as DeliveryRow).id, outcome: "expired" });
        }

        return respond({ processed: results.length, results });
    } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 200) : "unexpected";
        return respond({ error: { code: "DISPATCH_FAILED", message } }, 500);
    }
});
