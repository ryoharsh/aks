export type NotificationCategory = "insights" | "experiments" | "checkIns" | "weekly";

export type NativePermissionState =
    | "granted"
    | "denied"
    | "not_determined"
    | "provisional"
    | "unsupported";

export type PushSubscriptionSnapshot = {
    optedIn: boolean;
    permission: NativePermissionState;
    pushToken: string | null;
    subscriptionId: string | null;
};

export type NotificationTapPayload = {
    notificationId: string | null;
    category: NotificationCategory | null;
    notificationType: string | null;
    sourceType: string | null;
    sourceId: string | null;
    route: string | null;
};

export type NotificationTapResult =
    | { handled: true; payload: NotificationTapPayload }
    | { handled: false; reason: "unsupported" | "invalid_payload" };

export const notificationCategoryKeys: readonly NotificationCategory[] = ["insights", "experiments", "checkIns", "weekly"];

export function isNotificationCategory(value: unknown): value is NotificationCategory {
    return typeof value === "string" && (notificationCategoryKeys as readonly string[]).includes(value);
}

/** Validates the untrusted `additionalData` that arrives with a push tap. */
export function parseNotificationTapPayload(additionalData: unknown): NotificationTapPayload | null {
    if (!additionalData || typeof additionalData !== "object" || Array.isArray(additionalData)) return null;
    const raw = additionalData as Record<string, unknown>;
    if (raw.schema_version !== 1) return null;
    const route = typeof raw.route === "string" && raw.route.length <= 120 ? raw.route : null;
    return {
        notificationId: typeof raw.event_key === "string" && raw.event_key.length <= 200 ? raw.event_key : null,
        category: isNotificationCategory(raw.category) ? raw.category : null,
        notificationType: typeof raw.notification_type === "string" && raw.notification_type.length <= 80 ? raw.notification_type : null,
        sourceType: typeof raw.source_type === "string" && raw.source_type.length <= 60 ? raw.source_type : null,
        sourceId: typeof raw.source_id === "string" && /^[0-9a-f-]{1,64}$/i.test(raw.source_id) ? raw.source_id : null,
        route,
    };
}
