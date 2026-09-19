import { supabase } from "@/lib/supabase";
import { requireAuthenticatedUser } from "@/repositories/data.repository";

export type ContextBundle = {
    connectedSources: string[];
    observations: Array<{
        sourceType: string;
        observationType: string;
        observedAt: string;
        value: Record<string, unknown>;
    }>;
};

/**
 * Decides which observations are relevant to a conversation turn. Anchor is
 * the message time; only a bounded window and connected sources are included.
 * Irrelevant history never reaches the AI.
 */
export const contextResolver = {
    /**
     * Resolve the approved context bundle for a conversation turn. Only
     * relevant sources are requested (relevance filter) — never everything
     * connected, and always a bounded window.
     */
    async resolve(anchorIso: string | null, windowHours = 6, limit = 12, sourceFilter?: string[]): Promise<ContextBundle | null> {
        const user = await requireAuthenticatedUser();
        const { data, error } = await supabase.rpc("get_context_bundle", {
            p_user_id: user.id,
            p_anchor: anchorIso ?? new Date().toISOString(),
            p_window_hours: windowHours,
            p_limit: limit,
            ...(sourceFilter?.length ? { p_source_filter: sourceFilter as never } : {}),
        });
        if (error) return null;
        const bundle = data as ContextBundle;
        if (!bundle?.connectedSources?.length) return null;
        return bundle;
    },

    /** Short, honest sentence describing the active context sources. */
    transparencyLine(bundle: ContextBundle | null): string | null {
        if (!bundle || bundle.connectedSources.length === 0) return null;
        const names: Record<string, string> = {
            location: "location",
            calendar: "calendar",
            google_calendar: "Google Calendar",
            apple_calendar: "Apple Calendar",
            reminders: "tasks",
            google_tasks: "Google Tasks",
            apple_reminders: "Apple Reminders",
            todoist: "Todoist",
            notion: "Notion",
            github: "GitHub",
            slack: "Slack",
            email: "email",
            screen_time: "screen time",
            photos: "photos",
            voice_session: "voice",
        };
        const connected = bundle.connectedSources.map((source) => names[source] ?? source).join(" and ");
        return `You've connected your ${connected}, so Aks can see that context alongside what you share here.`;
    },
};
