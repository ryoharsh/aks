import { createClient } from "npm:@supabase/supabase-js@2";

import { findEndingExperiments } from "../_shared/notifications/sources.ts";
import { nextEligibleLocalTime, timezoneOffsetMinutes } from "../_shared/notifications/policy.ts";

const headers = { "Content-Type": "application/json" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHECKIN_LOCAL_HOUR = 19; // 19:00 local reminder for the daily check-in.
const WEEKLY_LOCAL_DAY = 0;    // Sunday evening weekly reflection.
const WEEKLY_LOCAL_HOUR = 18;

type PrefRow = {
    user_id: string;
    notifications_enabled: boolean | null;
    notification_categories: Record<string, unknown> | null;
    timezone: string | null;
};

function weekKey(now: Date, timezone: string): string {
    const offset = timezoneOffsetMinutes(now, timezone);
    const local = new Date(now.getTime() + offset * 60000);
    const localMonday = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - ((local.getUTCDay() + 6) % 7)));
    return localMonday.toISOString().slice(0, 10);
}

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers });
    if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);

    const apiKey = request.headers.get("apikey") ?? "";
    const configuredServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!configuredServiceKey || apiKey !== configuredServiceKey) return respond({ error: { code: "UNAUTHORIZED" } }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) return respond({ error: { code: "NOT_CONFIGURED" } }, 503);
    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const now = new Date();

    const { data: prefsRows, error } = await admin
        .from("user_preferences")
        .select("user_id, notifications_enabled, notification_categories, timezone")
        .eq("notifications_enabled", true)
        .limit(500);
    if (error) return respond({ error: { code: "PREFS_UNAVAILABLE", message: error.message.slice(0, 200) } }, 500);

    let scheduled = 0;
    for (const raw of prefsRows ?? []) {
        const prefs = raw as PrefRow;
        const categories = prefs.notification_categories ?? {};
        const timezone = prefs.timezone && prefs.timezone.length > 0 ? prefs.timezone : "UTC";

        try {
            // ---- Check-in reminder (opt-in category) ----
            if (categories.checkIns === true) {
                const todayUtc = now.toISOString().slice(0, 10);
                const { data: existing } = await admin.from("check_ins")
                    .select("id")
                    .eq("user_id", prefs.user_id)
                    .gte("created_at", `${todayUtc}T00:00:00Z`)
                    .limit(1);
                if (!existing || existing.length === 0) {
                    const eventKey = `checkin:${prefs.user_id}:${todayUtc}`;
                    const sendAt = nextEligibleLocalTime({
                        notificationsEnabled: true,
                        categories: { insights: false, experiments: false, checkIns: true, weekly: false },
                        quietHoursEnabled: false,
                        quietHours: { startMinute: 0, endMinute: 0 },
                        timezone,
                    }, now, CHECKIN_LOCAL_HOUR, 0);
                    const { error: claimError } = await admin.from("notification_deliveries").upsert({
                        user_id: prefs.user_id,
                        category: "checkIns",
                        source_type: "check_in",
                        source_id: null,
                        event_key: eventKey,
                        status: "scheduled",
                        scheduled_for: sendAt.toISOString(),
                        send_after: sendAt.toISOString(),
                        expires_at: new Date(sendAt.getTime() + 12 * 3600000).toISOString(),
                        payload: { title: "A moment to check in", body: "How did today feel? A quick check-in keeps your patterns accurate.", route: null },
                    }, { onConflict: "event_key" });
                    if (!claimError) scheduled += 1;
                }
            }

            // ---- Weekly reflection (opt-in category) ----
            if (categories.weekly === true) {
                const key = weekKey(now, timezone);
                const eventKey = `weekly:${prefs.user_id}:${key}`;
                const offset = timezoneOffsetMinutes(now, timezone);
                const local = new Date(now.getTime() + offset * 60000);
                const daysUntilSunday = (WEEKLY_LOCAL_DAY - local.getUTCDay() + 7) % 7;
                const targetLocal = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + daysUntilSunday, WEEKLY_LOCAL_HOUR, 0, 0));
                let sendAt = new Date(targetLocal.getTime() - offset * 60000);
                if (sendAt.getTime() <= now.getTime()) {
                    const nextWeek = new Date(targetLocal.getTime() + 7 * 86400000);
                    sendAt = new Date(nextWeek.getTime() - offset * 60000);
                }
                const { error: weeklyError } = await admin.from("notification_deliveries").upsert({
                    user_id: prefs.user_id,
                    category: "weekly",
                    source_type: "week",
                    source_id: null,
                    event_key: eventKey,
                    status: "scheduled",
                    scheduled_for: sendAt.toISOString(),
                    send_after: sendAt.toISOString(),
                    expires_at: new Date(sendAt.getTime() + 48 * 3600000).toISOString(),
                    payload: { title: "Your week, reflected", body: "Your weekly reflection is ready when you are.", route: null },
                }, { onConflict: "event_key" });
                if (!weeklyError) scheduled += 1;
            }
        } catch {
            // One user failing must never block the batch.
        }
    }

    // ---- Experiment "ending soon" reminders (active experiments only) ----
    try {
        const ending = await findEndingExperiments(admin);
        for (const experiment of ending) {
            const { data: prefRow } = await admin.from("user_preferences")
                .select("notification_categories")
                .eq("user_id", experiment.user_id)
                .maybeSingle();
            if ((prefRow?.notification_categories as Record<string, unknown> | null)?.experiments !== true) continue;
            const { error: endingError } = await admin.from("notification_deliveries").upsert({
                user_id: experiment.user_id,
                category: "experiments",
                source_type: "experiment",
                source_id: experiment.id,
                event_key: `experiment:${experiment.id}:ending`,
                status: "scheduled",
                scheduled_for: now.toISOString(),
                send_after: now.toISOString(),
                expires_at: new Date(now.getTime() + 24 * 3600000).toISOString(),
                payload: { title: "Your experiment is wrapping up", body: experiment.title.slice(0, 140), route: "ExperimentDetail" },
            }, { onConflict: "event_key" });
            if (!endingError) scheduled += 1;
        }
    } catch {
        // Experiment scheduling must never block the rest of the batch.
    }

    return respond({ scheduled });
});
