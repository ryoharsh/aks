// Notification policy for the OneSignal delivery layer.
// Pure logic — deterministic time injection for tests. This layer decides
// WHETHER and WHEN an eligible Aks event may be delivered. It never decides
// WHAT is worth notifying about.

export type NotificationCategory = "insights" | "experiments" | "checkIns" | "weekly";

export type NotificationPreferences = {
    notificationsEnabled: boolean;
    categories: Record<NotificationCategory, boolean>;
    quietHoursEnabled: boolean;
    quietHours: { startMinute: number; endMinute: number };
    timezone: string;
};

export type NotificationCandidate = {
    userId: string;
    category: NotificationCategory;
    sourceType: string;
    sourceId: string | null;
    eventKey: string;
    title: string;
    body: string;
    route: string | null;
};

export type PolicyDecision =
    | { deliverable: true }
    | { deliverable: false; reason: "globally_disabled" | "category_disabled" | "quiet_hours" | "missing_timezone" };

const defaultQuietHours = { startMinute: 22 * 60, endMinute: 7 * 60 };

export function normalizePreferences(raw: {
    notifications_enabled: boolean | null;
    notification_categories: Record<string, unknown> | null;
    quiet_hours_enabled: boolean | null;
    timezone: string | null;
} | null): NotificationPreferences {
    const categories = (raw?.notification_categories ?? {}) as Record<string, unknown>;
    const toBool = (value: unknown) => value === true;
    return {
        notificationsEnabled: raw?.notifications_enabled === true,
        categories: {
            insights: toBool(categories.insights),
            experiments: toBool(categories.experiments),
            checkIns: toBool(categories.checkIns),
            weekly: toBool(categories.weekly),
        },
        quietHoursEnabled: raw?.quiet_hours_enabled === true,
        quietHours: defaultQuietHours,
        timezone: raw?.timezone && raw.timezone.trim().length > 0 && raw.timezone.length <= 64 ? raw.timezone.trim() : "UTC",
    };
}

export function evaluatePolicy(candidate: { category: NotificationCategory }, prefs: NotificationPreferences): PolicyDecision {
    if (!prefs.notificationsEnabled) return { deliverable: false, reason: "globally_disabled" };
    if (!prefs.categories[candidate.category]) return { deliverable: false, reason: "category_disabled" };
    return { deliverable: true };
}

/** Minutes since local midnight for a UTC instant in an IANA timezone. */
export function localMinuteOf(utc: Date, timezone: string): number {
    const offsetMinutes = timezoneOffsetMinutes(utc, timezone);
    return ((Math.floor(utc.getTime() / 60000) + offsetMinutes) % 1440 + 1440) % 1440;
}

/** Offset of an IANA zone from UTC in minutes at the given instant (e.g. +330 for IST). */
export function timezoneOffsetMinutes(utc: Date, timezone: string): number {
    try {
        const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", year: "numeric", month: "2-digit", day: "2-digit" });
        const parts = formatter.formatToParts(utc);
        const lookup: Record<string, number> = {};
        for (const part of parts) {
            if (part.type !== "literal") lookup[part.type] = Number(part.value);
        }
        const asUtc = Date.UTC(lookup.year, (lookup.month ?? 1) - 1, lookup.day, lookup.hour % 24, lookup.minute, lookup.second);
        return Math.round((asUtc - utc.getTime()) / 60000);
    } catch {
        return 0; // Unknown zone falls back to UTC.
    }
}

export function isWithinQuietHours(prefs: NotificationPreferences, nowUtc: Date): boolean {
    if (!prefs.quietHoursEnabled) return false;
    const localMinute = localMinuteOf(nowUtc, prefs.timezone);
    const { startMinute, endMinute } = prefs.quietHours;
    if (startMinute === endMinute) return true;
    if (startMinute < endMinute) return localMinute >= startMinute && localMinute < endMinute;
    return localMinute >= startMinute || localMinute < endMinute;
}

export function canDeliverNow(candidate: { category: NotificationCategory }, prefs: NotificationPreferences, nowUtc: Date): PolicyDecision {
    const gate = evaluatePolicy(candidate, prefs);
    if (!gate.deliverable) return gate;
    if (isWithinQuietHours(prefs, nowUtc)) return { deliverable: false, reason: "quiet_hours" };
    return { deliverable: true };
}

/**
 * Next UTC instant at/after `fromUtc` whose LOCAL time is the requested
 * hh:mm in the user's timezone and outside quiet hours. If the preferred
 * wall-clock time keeps colliding with quiet hours, rolls forward in
 * 30-minute steps so a candidate is always found within ~48h.
 */
export function nextEligibleLocalTime(prefs: NotificationPreferences, fromUtc: Date, localHour: number, localMinute: number): Date {
    const offset = timezoneOffsetMinutes(fromUtc, prefs.timezone);
    const local = new Date(fromUtc.getTime() + offset * 60000);
    const preferredLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), localHour, localMinute, 0, 0);
    const firstCandidate = new Date(preferredLocal - offset * 60000);
    const start = firstCandidate.getTime() >= fromUtc.getTime() ? firstCandidate.getTime() : firstCandidate.getTime() + 86400000;
    for (let step = 0; step <= 96; step += 1) {
        const candidate = new Date(start + step * 30 * 60000);
        if (!isWithinQuietHours(prefs, candidate)) return candidate;
    }
    return new Date(start + 48 * 3600000);
}

/** Bounded retry backoff for failed OneSignal sends (never endless). */
export function retryDelayMinutes(attemptCount: number): number | null {
    if (attemptCount >= 3) return null;
    return attemptCount === 0 ? 5 : attemptCount === 1 ? 30 : 240;
}
