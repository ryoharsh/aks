import { supabase } from "@/lib/supabase";
import type { Language } from "@/localization/languages";
import type { Database, Json } from "@/types/database";

export type AppearancePreference = "system" | "light" | "dark";

export type NotificationCategoryKey = "insights" | "experiments" | "checkIns" | "weekly";

export type UserPreferences = {
    appearance: AppearancePreference;
    whatExploring: string[];
    whatToNotice: string[];
    notificationsEnabled: boolean;
    notificationCategories: Record<NotificationCategoryKey, boolean>;
    quietHoursEnabled: boolean;
    /** Explicit IANA timezone choice. Null follows the device-reported zone. */
    timezone: string | null;
    /** Server-side display-language choice. Null means none made yet. */
    language: Language | null;
};

const defaults: UserPreferences = {
    appearance: "system",
    whatExploring: [],
    whatToNotice: [],
    notificationsEnabled: true,
    notificationCategories: {
        insights: true,
        experiments: true,
        checkIns: false,
        weekly: true,
    },
    quietHoursEnabled: true,
    timezone: null,
    language: null,
};

type PreferencesRow = {
    appearance: AppearancePreference;
    what_exploring: string[] | null;
    what_to_notice: string[] | null;
    notifications_enabled: boolean | null;
    notification_categories: Json | null;
    quiet_hours_enabled: boolean | null;
    timezone: string | null;
    language: string | null;
};

const LANGUAGE_CODES: readonly Language[] = ["en", "hi", "fr", "es", "zh", "ja", "ko", "ar", "ur"];

/** Select-list shared by get/update; language mirrors the new column. */
const COLUMNS = "appearance, what_exploring, what_to_notice, notifications_enabled, notification_categories, quiet_hours_enabled, timezone, language";

/** Trusts only known codes; anything else (old clients, manual edits) is null. */
function parseLanguage(value: string | null): Language | null {
    return value !== null && (LANGUAGE_CODES as readonly string[]).includes(value) ? (value as Language) : null;
}

function mapCategories(value: Json | null): Record<NotificationCategoryKey, boolean> {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    return {
        insights: source.insights !== false,
        experiments: source.experiments !== false,
        checkIns: source.checkIns === true,
        weekly: source.weekly !== false,
    };
}

function mapPreferences(row: PreferencesRow): UserPreferences {
    return {
        appearance: row.appearance,
        whatExploring: row.what_exploring ?? [],
        whatToNotice: row.what_to_notice ?? [],
        notificationsEnabled: row.notifications_enabled ?? defaults.notificationsEnabled,
        notificationCategories: mapCategories(row.notification_categories),
        quietHoursEnabled: row.quiet_hours_enabled ?? defaults.quietHoursEnabled,
        timezone: row.timezone ?? null,
        language: parseLanguage(row.language),
    };
}

export const preferencesService = {
    async getOrCreate(userId: string) {
        const { error: insertError } = await supabase
            .from("user_preferences")
            .upsert(
                { user_id: userId },
                { onConflict: "user_id", ignoreDuplicates: true },
            );
        if (insertError) throw insertError;

        const { data, error } = await supabase
            .from("user_preferences")
            .select(COLUMNS)
            .eq("user_id", userId)
            .single();
        if (error) throw error;
        return mapPreferences(data as PreferencesRow);
    },

    async update(userId: string, values: Partial<UserPreferences>) {
        const payload: Database["public"]["Tables"]["user_preferences"]["Insert"] = {
            user_id: userId,
            updated_at: new Date().toISOString(),
        };
        if (values.appearance !== undefined) payload.appearance = values.appearance;
        if (values.whatExploring !== undefined) payload.what_exploring = values.whatExploring;
        if (values.whatToNotice !== undefined) payload.what_to_notice = values.whatToNotice;
        if (values.notificationsEnabled !== undefined) payload.notifications_enabled = values.notificationsEnabled;
        if (values.notificationCategories !== undefined) payload.notification_categories = values.notificationCategories;
        if (values.quietHoursEnabled !== undefined) payload.quiet_hours_enabled = values.quietHoursEnabled;
        if (values.timezone !== undefined) payload.timezone = values.timezone;
        if (values.language !== undefined) payload.language = values.language;

        const { data, error } = await supabase
            .from("user_preferences")
            .upsert(payload, { onConflict: "user_id" })
            .select(COLUMNS)
            .single();
        if (error) throw error;
        return mapPreferences(data as PreferencesRow);
    },

    /** Keeps the server's scheduling timezone aligned with the device zone. */
    async syncNotificationTimezone() {
        try {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (!timezone) return;
            await supabase.rpc("touch_notification_timezone", { p_timezone: timezone });
        } catch {
            // Scheduling falls back to UTC when the sync fails.
        }
    },

    defaults,
};
