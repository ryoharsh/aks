// Notification engine shared by the send (immediate) and dispatch (scheduled)
// Edge Functions. Claim -> policy -> quiet hours -> stale re-check -> send ->
// persist state. All source ownership validation happens inside the database
// claim gate; this module never trusts client-provided routing.

import { canDeliverNow, normalizePreferences, retryDelayMinutes } from "./policy.ts";
import { sendPushToUser, type OneSignalClientConfig } from "./onesignal.client.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type EngineDeps = {
    adminClient: SupabaseClient;
    oneSignal: OneSignalClientConfig;
    now?: () => Date;
};

export type DeliveryRow = {
    id: string;
    user_id: string;
    category: "insights" | "experiments" | "checkIns" | "weekly";
    source_type: string;
    source_id: string | null;
    event_key: string;
    status: string;
    scheduled_for: string | null;
    expires_at: string | null;
    attempt_count: number;
    payload: { title?: string; body?: string; route?: string | null };
};

export type SendOutcome =
    | { outcome: "sent" | "skipped" | "suppressed" | "deduplicated" | "expired" | "failed"; deliveryId: string | null; detail?: string };

/** Claims a candidate via the database gate (preferences, category, dedup, ownership). */
export async function claimDelivery(
    deps: EngineDeps,
    input: {
        userId: string;
        category: DeliveryRow["category"];
        sourceType: string;
        sourceId: string | null;
        eventKey: string;
        title: string;
        body: string;
        route: string | null;
        scheduledFor?: string | null;
        expiresAt?: string | null;
        timezone?: string | null;
    },
): Promise<{ status: string; deliveryId: string | null; reason?: string }> {
    const { data, error } = await deps.adminClient.rpc("claim_notification_delivery", {
        p_user_id: input.userId,
        p_category: input.category,
        p_source_type: input.sourceType,
        p_source_id: input.sourceId,
        p_event_key: input.eventKey,
        p_title: input.title,
        p_body: input.body,
        p_route: input.route,
        p_scheduled_for: input.scheduledFor ?? null,
        p_expires_at: input.expiresAt ?? null,
        p_timezone: input.timezone ?? null,
    });
    if (error) throw new Error(error.message);
    const result = data as { status: string; delivery_id?: string; reason?: string };
    return { status: result.status, deliveryId: result.delivery_id ?? null, reason: result.reason };
}

/** Stale-source re-check immediately before sending a scheduled/candidate row. */
export async function isSourceStillValid(deps: EngineDeps, row: DeliveryRow): Promise<boolean> {
    const admin = deps.adminClient;
    switch (row.category) {
        case "insights": {
            if (!row.source_id) return false;
            const { data } = await admin.from("insights").select("status").eq("id", row.source_id).maybeSingle();
            return data?.status === "new" || data?.status === "seen";
        }
        case "experiments": {
            if (!row.source_id) return false;
            const { data } = await admin.from("experiments").select("status").eq("id", row.source_id).maybeSingle();
            if (!data?.status) return false;
            const kind = row.event_key.split(":").pop() ?? "";
            if (kind === "ending") return data.status === "active";
            if (kind === "completed" || kind === "outcome") return data.status === "completed";
            if (kind === "started") return data.status === "active" || data.status === "completed";
            return false;
        }
        case "checkIns": {
            // Reminder valid only if the user has NOT checked in today (UTC date).
            const { data } = await admin.from("check_ins")
                .select("id")
                .eq("user_id", row.user_id)
                .gte("created_at", new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").toISOString())
                .limit(1);
            return !(data && data.length > 0);
        }
        case "weekly": {
            // Weekly is valid only in its week; dedup key already enforces once per week.
            return row.event_key.startsWith("weekly:");
        }
        default:
            return false;
    }
}

/** Sends one delivery row through OneSignal and persists the resulting state. */
export async function processDelivery(deps: EngineDeps, row: DeliveryRow): Promise<SendOutcome> {
    const now = deps.now ?? (() => new Date());
    const admin = deps.adminClient;

    if (row.expires_at && new Date(row.expires_at).getTime() < now().getTime()) {
        await admin.from("notification_deliveries").update({ status: "expired", updated_at: now().toISOString() }).eq("id", row.id);
        return { outcome: "expired", deliveryId: row.id };
    }

    const { data: prefRow } = await admin.from("user_preferences")
        .select("notifications_enabled, notification_categories, quiet_hours_enabled, timezone")
        .eq("user_id", row.user_id)
        .maybeSingle();
    const prefs = normalizePreferences(prefRow as never);

    const gate = canDeliverNow({ category: row.category }, prefs, now());
    if (!gate.deliverable) {
        if (gate.reason === "quiet_hours" && row.scheduled_for) {
            // Keep the scheduled row for the next eligible slot; nothing to do now.
            return { outcome: "skipped", deliveryId: row.id, detail: "quiet_hours" };
        }
        await admin.from("notification_deliveries").update({ status: "skipped", failure_reason: gate.reason, updated_at: now().toISOString() }).eq("id", row.id);
        return { outcome: "skipped", deliveryId: row.id, detail: gate.reason };
    }

    if (!(await isSourceStillValid(deps, row))) {
        await admin.from("notification_deliveries").update({ status: "cancelled", failure_reason: "source_invalid", updated_at: now().toISOString() }).eq("id", row.id);
        return { outcome: "suppressed", deliveryId: row.id, detail: "source_invalid" };
    }

    await admin.from("notification_deliveries").update({ status: "sending", updated_at: now().toISOString() }).eq("id", row.id);

    const title = (row.payload.title ?? "").trim();
    const body = (row.payload.body ?? "").trim();
    if (!title || !body) {
        await admin.from("notification_deliveries").update({ status: "failed", failure_reason: "invalid_payload", updated_at: now().toISOString() }).eq("id", row.id);
        return { outcome: "failed", deliveryId: row.id, detail: "invalid_payload" };
    }

    const result = await sendPushToUser(deps.oneSignal, row.user_id, {
        title,
        body,
        data: {
            notification_type: row.category,
            category: row.category,
            source_type: row.source_type,
            source_id: row.source_id,
            event_key: row.event_key,
            route: row.payload.route ?? null,
            schema_version: 1,
        },
    }, row.event_key);

    if (result.ok) {
        await admin.from("notification_deliveries").update({
            status: "sent",
            onesignal_message_id: result.messageId,
            sent_at: now().toISOString(),
            failure_reason: null,
            updated_at: now().toISOString(),
        }).eq("id", row.id);
        return { outcome: "sent", deliveryId: row.id };
    }

    const delay = retryDelayMinutes(row.attempt_count);
    await admin.from("notification_deliveries").update({
        status: result.retryable && delay !== null ? "scheduled" : "failed",
        failure_reason: result.errors.join("; ").slice(0, 200),
        attempt_count: row.attempt_count + 1,
        scheduled_for: result.retryable && delay !== null ? new Date(now().getTime() + delay * 60000).toISOString() : row.scheduled_for,
        updated_at: now().toISOString(),
    }).eq("id", row.id);
    return { outcome: "failed", deliveryId: row.id, detail: result.errors.join("; ") };
}
