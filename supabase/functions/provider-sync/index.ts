// Provider sync dispatcher (cron). Claims due provider_sync_jobs, fetches
// provider data with SERVER-HELD tokens (never sent to the client or AI),
// normalizes through the fetchers, and ingests via the service-role
// ingest_provider_observation RPC (validate -> dedupe -> observation -> signal).
// Retry-safe: claimed atomically, completed with bounded backoff.

import { createClient } from "npm:@supabase/supabase-js@2";

import { PROVIDER_FETCHERS, type ProviderFetchContext } from "../_shared/providers/fetchers.ts";

const headers = { "Content-Type": "application/json" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

const VALID_SOURCES = new Set([
    "google_calendar", "google_tasks", "todoist", "github", "slack", "email", "notion",
]);
// Slack is now in PROVIDER_FETCHERS (workspace-wide public channels).

function classify(status: number | undefined): "temporary" | "error" {
    // 401/403 need re-consent (not transient), 429/5xx are transient.
    return status === undefined || status === 401 || status === 403 ? "error" : "temporary";
}

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: { ...headers, "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
    if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);

    const apiKey = request.headers.get("apikey") ?? "";
    const configuredServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!configuredServiceKey || apiKey !== configuredServiceKey) {
        return respond({ error: { code: "UNAUTHORIZED" } }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) return respond({ error: { code: "NOT_CONFIGURED" } }, 503);

    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

    try {
        const { data: jobs, error: claimError } = await admin.rpc("claim_provider_sync_jobs", { p_limit: 20 });
        if (claimError) throw claimError;
        const claimed = (jobs ?? []) as Array<{ job_id: string; job_user_id: string; source_type: string; payload: Record<string, unknown>; attempts: number }>;
        if (claimed.length === 0) return respond({ processed: 0 });

        const sent: string[] = [];
        const failed: string[] = [];
        const skipped: string[] = [];
        const retryDelays: Record<string, number> = {};
        const errors: Record<string, string> = {};

        for (const job of claimed) {
            const fetcher = PROVIDER_FETCHERS[job.source_type];
            if (!fetcher || !VALID_SOURCES.has(job.source_type)) {
                skipped.push(job.job_id);
                errors[job.job_id] = "no_fetcher";
                continue;
            }

            // Find the server-held account link + its vault secret reference.
            const { data: account, error: accountError } = await admin
                .from("user_source_accounts")
                .select("id, token_ref, status")
                .eq("user_id", job.job_user_id)
                .eq("source_type", job.source_type)
                .eq("status", "connected")
                .maybeSingle();
            if (accountError || !account) {
                skipped.push(job.job_id);
                errors[job.job_id] = "account_not_linked";
                continue;
            }

            const { data: token, error: tokenError } = await admin.rpc("get_provider_access_token", { p_token_ref: account.token_ref });
            if (tokenError || !token) {
                skipped.push(job.job_id);
                errors[job.job_id] = "token_unavailable";
                continue;
            }

            const cursor = (job.payload?.cursor as string | undefined) ?? new Date(Date.now() - 36 * 3600 * 1000).toISOString();
            const context: ProviderFetchContext = {
                accessToken: token as string,
                sinceIso: cursor,
                untilIso: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            };

            try {
                const drafts = await fetcher(context);
                let created = 0;
                let deduplicated = 0;
                for (const draft of drafts) {
                    const { data: result, error: ingestError } = await admin.rpc("ingest_provider_observation", {
                        p_user_id: job.job_user_id,
                        p_source_type: job.source_type,
                        p_observation_type: draft.observationType,
                        p_source_event_id: draft.sourceEventId,
                        p_observed_at: draft.observedAt,
                        p_value: draft.value,
                        p_confidence: draft.confidence ?? null,
                        p_metadata: { provider: job.source_type },
                    });
                    if (ingestError) continue;
                    const status = (result as { status?: string } | null)?.status;
                    if (status === "created") created += 1;
                    else if (status === "deduplicated") deduplicated += 1;
                }

                const nextCursor = new Date().toISOString();
                await admin.rpc("record_sync_result", {
                    p_user_id: job.job_user_id,
                    p_source_type: job.source_type,
                    p_status: "ok",
                    p_cursor: { cursor: nextCursor },
                    p_error: null,
                });
                sent.push(job.job_id);
                void created; void deduplicated; // logged via delivery counts in response
            } catch (fetchError) {
                const kind = classify((fetchError as Error & { status?: number }).status);
                const message = (fetchError as Error).message.slice(0, 200);
                await admin.rpc("record_sync_result", {
                    p_user_id: job.job_user_id,
                    p_source_type: job.source_type,
                    p_status: kind,
                    p_error: message,
                });
                errors[job.job_id] = message;
                // Bounded backoff: attempts 1-2 -> 10 min, 3+ -> 60 min; stop after 10.
                retryDelays[job.job_id] = job.attempts >= 3 ? 3600 : 600;
                failed.push(job.job_id);
            }
        }

        if (sent.length) await admin.rpc("complete_provider_sync_jobs", { p_job_ids: sent, p_status: "sent" });
        if (skipped.length) await admin.rpc("complete_provider_sync_jobs", { p_job_ids: skipped, p_status: "skipped", p_error: "skipped" });
        if (failed.length) {
            for (const jobId of failed) {
                await admin.rpc("complete_provider_sync_jobs", { p_job_ids: [jobId], p_status: "failed", p_error: errors[jobId] ?? "failed", p_retry_delay_seconds: retryDelays[jobId] ?? 600 });
            }
        }

        return respond({ processed: claimed.length, sent: sent.length, failed: failed.length, skipped: skipped.length });
    } catch (error) {
        return respond({ error: { code: "INTERNAL", message: (error as Error).message.slice(0, 200) } }, 500);
    }
});
