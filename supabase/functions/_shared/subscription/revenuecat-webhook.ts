// Pure RevenueCat webhook mapping for the `revenuecat-webhook` Edge Function.
//
// Kept dependency-free (no `npm:` imports) so it runs under both Deno and
// vitest. The webhook itself stays a thin HTTP + auth + storage wrapper.
//
// Mirror semantics: the `public.subscriptions` row reflects the latest known
// RevenueCat state for the `premium` entitlement. The client never writes
// this table; only the webhook (service role) does, via idempotent upserts.

export const DEFAULT_ENTITLEMENT = "premium";

export const REVENUECAT_EVENT_TO_STATUS: Record<string, string> = {
    INITIAL_PURCHASE: "active",
    NON_RENEWING_PURCHASE: "active",
    PRODUCT_CHANGE: "active",
    RENEWAL: "active",
    SUBSCRIPTION_EXTENDED: "active",
    TEMPORARY_ENTITLEMENT_GRANT: "active",
    TRANSFER: "active",
    TRIAL_CONVERTED: "active",
    TRIAL_STARTED: "active",
    UNCANCELLATION: "active",
    BILLING_ISSUE: "billing_issue",
    CANCELLATION: "cancelled",
    SUBSCRIPTION_PAUSED: "cancelled",
    EXPIRATION: "expired",
    REFUND: "expired",
};

export type RevenueCatWebhookEvent = Record<string, unknown>;

export type SubscriptionMirrorRow = {
    user_id: string;
    revenuecat_customer_id: string;
    entitlement: string;
    product_id: string | null;
    status: string;
    expires_at: string | null;
    updated_at: string;
};

function asString(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function statusForRevenueCatEvent(eventType: string): string | null {
    return REVENUECAT_EVENT_TO_STATUS[eventType] ?? null;
}

export function eventTimeMs(event: RevenueCatWebhookEvent): number | null {
    return (
        asNumber(event.event_timestamp_ms) ??
        asNumber(event.purchased_at_ms) ??
        null
    );
}

/**
 * Build the mirror row for a RevenueCat event, or `null` when the event
 * carries no actionable subscription state (unknown type / missing user).
 * The client logs in to RevenueCat with the Supabase user id, so
 * `revenuecat_customer_id` and `user_id` match.
 */
export function buildSubscriptionMirrorRow(
    event: RevenueCatWebhookEvent,
    nowIso: string = new Date().toISOString(),
): SubscriptionMirrorRow | null {
    const eventType = asString(event.type) ?? "";
    const status = statusForRevenueCatEvent(eventType);
    const appUserId = asString(event.app_user_id);
    if (!status || !appUserId) {
        return null;
    }
    const entitlementIds = Array.isArray(event.entitlement_ids)
        ? event.entitlement_ids.filter(
              (id): id is string => typeof id === "string" && id.length > 0,
          )
        : [];
    const expirationAtMs = asNumber(event.expiration_at_ms);
    const eventTime = eventTimeMs(event);
    return {
        user_id: appUserId,
        revenuecat_customer_id: appUserId,
        entitlement: entitlementIds[0] ?? DEFAULT_ENTITLEMENT,
        product_id: asString(event.product_id),
        status,
        expires_at:
            expirationAtMs !== null
                ? new Date(expirationAtMs).toISOString()
                : null,
        // Pin `updated_at` to the event time when available so redeliveries
        // of the same event produce byte-identical rows (idempotent) and
        // out-of-order deliveries can be detected.
        updated_at:
            eventTime !== null ? new Date(eventTime).toISOString() : nowIso,
    };
}

/**
 * Out-of-order guard: skip an event older than the stored state.
 * Events without a timestamp always apply; rows without a timestamp never
 * block. Equal timestamps apply (idempotent re-delivery).
 */
export function shouldApplyWebhookEvent(
    existingUpdatedAt: string | null,
    incomingUpdatedAt: string,
): boolean {
    if (!existingUpdatedAt) {
        return true;
    }
    const existingMs = Date.parse(existingUpdatedAt);
    const incomingMs = Date.parse(incomingUpdatedAt);
    if (Number.isNaN(existingMs) || Number.isNaN(incomingMs)) {
        return true;
    }
    return incomingMs >= existingMs;
}
