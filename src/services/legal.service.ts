import { supabase } from "@/lib/supabase";

export const CURRENT_TERMS_VERSION = "2026-09-17";
export const CURRENT_PRIVACY_VERSION = "2026-09-17";

export const legalService = {
    async hasCurrentAcceptance(userId: string) {
        const { data, error } = await supabase
            .from("legal_acceptances")
            .select("user_id")
            .eq("user_id", userId)
            .eq("terms_version", CURRENT_TERMS_VERSION)
            .eq("privacy_version", CURRENT_PRIVACY_VERSION)
            .maybeSingle();
        if (error) throw error;
        return Boolean(data);
    },

    async acceptCurrent(_userId: string) {
        const { error } = await supabase.rpc("accept_current_legal");
        if (error) throw error;
    },
};
