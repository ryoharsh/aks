import { createClient } from "npm:@supabase/supabase-js@2";

// User-scoped tables whose rows belong to a single user. Internal engine
// tables (ai_runs, ai_run_attempts) are intentionally excluded from export.
const TABLE_SPECS = [
    { table: "user_preferences", order: "updated_at" },
    { table: "legal_acceptances", order: "accepted_at" },
    { table: "conversations", order: "created_at" },
    { table: "messages", order: "created_at" },
    { table: "reflections", order: "created_at" },
    { table: "check_ins", order: "created_at" },
    { table: "signals", order: "created_at" },
    { table: "memories", order: "created_at" },
    { table: "memory_evidence", order: "created_at" },
    { table: "patterns", order: "created_at" },
    { table: "pattern_evidence", order: "created_at" },
    { table: "experiments", order: "created_at" },
    { table: "experiment_observations", order: "created_at" },
    { table: "learnings", order: "created_at" },
    { table: "learning_evidence", order: "created_at" },
    { table: "insights", order: "created_at" },
    { table: "timeline_events", order: "created_at" },
    // Connected-source context actually collected for this account. Provider
    // account rows are intentionally excluded: they hold internal token
    // references, which never belong in a user-facing export.
    { table: "observations", order: "observed_at" },
    { table: "user_data_sources", order: "created_at" },
    { table: "data_sources", order: "connected_at" },
] as const;

const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const EXPORT_TTL_SECONDS = 300;
const PAGE_SIZE = 1000;

async function fetchUserTableRecords(
    admin: ReturnType<typeof createClient>,
    userId: string,
    table: string,
    orderColumn: string,
): Promise<unknown[]> {
    const records: unknown[] = [];
    let offset = 0;
    while (true) {
        const { data, error } = await admin
            .from(table)
            .select("*")
            .eq("user_id", userId)
            .order(orderColumn, { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw new Error(`UNABLE_TO_READ_TABLE:${table}`);
        records.push(...(data ?? []));
        if ((data?.length ?? 0) < PAGE_SIZE) break;
        offset += PAGE_SIZE;
    }
    return records;
}

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers });
    if (request.method !== "POST") return respond({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } }, 405);

    try {
        const authorization = request.headers.get("Authorization");
        const url = Deno.env.get("SUPABASE_URL");
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!authorization || !url || !anonKey || !serviceRoleKey) {
            return respond({ error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } }, 401);
        }

        const userClient = createClient(url, anonKey, {
            global: { headers: { Authorization: authorization } },
            auth: { persistSession: false },
        });
        const { data: { user }, error: userError } = await userClient.auth.getUser();
        if (userError || !user) {
            return respond({ error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } }, 401);
        }

        const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

        const data: Record<string, unknown> = {};
        for (const spec of TABLE_SPECS) {
            data[spec.table] = await fetchUserTableRecords(admin, user.id, spec.table, spec.order);
        }

        const exportedAt = new Date();
        const fileName = `aks-export-${exportedAt.toISOString().replace(/[:.]/g, "-")}.json`;
        const exportPayload = {
            format: "aks-export/v1",
            exportedAt: exportedAt.toISOString(),
            profile: {
                email: user.email ?? null,
                createdAt: user.created_at ?? null,
                fullName: (user.user_metadata as { full_name?: string } | undefined)?.full_name ?? null,
                avatarUrl: (user.user_metadata as { avatar_url?: string } | undefined)?.avatar_url ?? null,
            },
            data,
        };

        const path = `${user.id}/${fileName}`;
        const bytes = new TextEncoder().encode(JSON.stringify(exportPayload));
        const { error: uploadError } = await admin.storage.from("exports").upload(path, bytes, {
            contentType: "application/json",
            cacheControl: "3600",
        });
        if (uploadError) {
            return respond({ error: { code: "EXPORT_UNAVAILABLE", message: "The export could not be created." } }, 500);
        }

        const { data: signedData, error: signedError } = await admin.storage
            .from("exports")
            .createSignedUrl(path, EXPORT_TTL_SECONDS);
        if (signedError || !signedData?.signedUrl) {
            return respond({ error: { code: "EXPORT_UNAVAILABLE", message: "The export could not be created." } }, 500);
        }

        return respond({
            fileName,
            url: signedData.signedUrl,
            expiresAt: new Date(exportedAt.getTime() + EXPORT_TTL_SECONDS * 1000).toISOString(),
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "";
        if (errorMessage.startsWith("UNABLE_TO_READ_TABLE:")) {
            return respond({ error: { code: "EXPORT_UNAVAILABLE", message: "The export could not be created." } }, 500);
        }
        return respond({ error: { code: "UNEXPECTED", message: "Something went wrong." } }, 500);
    }
});