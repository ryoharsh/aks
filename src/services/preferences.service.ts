import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type AppearancePreference = "system" | "light" | "dark";

export type UserPreferences = {
    appearance: AppearancePreference;
    whatExploring: string[];
    whatToNotice: string[];
};

const defaults: UserPreferences = {
    appearance: "system",
    whatExploring: [],
    whatToNotice: [],
};

type PreferencesRow = {
    appearance: AppearancePreference;
    what_exploring: string[] | null;
    what_to_notice: string[] | null;
};

function mapPreferences(row: PreferencesRow): UserPreferences {
    return {
        appearance: row.appearance,
        whatExploring: row.what_exploring ?? [],
        whatToNotice: row.what_to_notice ?? [],
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
            .select("appearance, what_exploring, what_to_notice")
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

        const { data, error } = await supabase
            .from("user_preferences")
            .upsert(payload, { onConflict: "user_id" })
            .select("appearance, what_exploring, what_to_notice")
            .single();
        if (error) throw error;
        return mapPreferences(data as PreferencesRow);
    },

    defaults,
};
