import { supabase } from "@/lib/supabase";
import { requireAuthenticatedUser, throwDataError } from "@/repositories/data.repository";
import { sourceAdapters, type ProviderAdapter } from "./adapters";
import { OAUTH_SOURCE_NAMES } from "./oauth";
import type { ContextSourceType, ObservationDraft } from "./types";
import { copy } from "@/constants/copy";

/**
 * SyncManager — the controlled sync lifecycle for every provider.
 *
 * connect → initial sync → incremental sync (bounded, deduplicated) →
 * error/temporary failure → recovery → disconnect.
 *
 * - OS sources (location, calendar, reminders) are collected on-device by
 *   their adapters and ingested through the validated `upsert_observation`
 *   RPC — never raw dumps.
 * - OAuth sources are synced server-side: the client only enqueues a
 *   deduplicated job (`enqueue_provider_sync`); the `provider-sync` Edge
 *   Function fetches with server-held tokens and ingests through the
 *   service-role `ingest_provider_observation` RPC.
 * - Every source has a minimum sync interval; retries never spam providers
 *   and never duplicate observations (stable source_event_id + DB dedup).
 */

const MIN_SYNC_INTERVAL_MINUTES: Partial<Record<ContextSourceType, number>> = {
    location: 15,
    calendar: 60,
    google_calendar: 60,
    apple_calendar: 60,
    reminders: 240,
    google_tasks: 240,
    apple_reminders: 240,
    todoist: 240,
    github: 360,
    slack: 180,
    email: 180,
    notion: 360,
    screen_time: 720,
};

export type SyncOutcome = {
    sourceType: ContextSourceType;
    status: "synced" | "deferred" | "enqueued" | "error";
    created: number;
    deduplicated: number;
    error?: string;
};

function isDue(lastSyncedAt: string | null, minIntervalMinutes: number): boolean {
    if (!lastSyncedAt) return true;
    return Date.now() - Date.parse(lastSyncedAt) >= minIntervalMinutes * 60000;
}

async function ingestDrafts(
    userId: string,
    sourceType: ContextSourceType,
    drafts: ObservationDraft[],
): Promise<{ created: number; deduplicated: number }> {
    let created = 0;
    let deduplicated = 0;
    for (const draft of drafts) {
        const { data, error } = await supabase.rpc("upsert_observation", {
            p_user_id: userId,
            p_source_type: draft.sourceType,
            p_observation_type: draft.observationType,
            p_source_event_id: draft.sourceEventId,
            p_observed_at: draft.observedAt,
            p_value: draft.value as never,
            p_confidence: draft.confidence ?? null,
            p_metadata: (draft.metadata ?? {}) as never,
        });
        if (error) continue; // invalid values are dropped; a bad draft never fails the batch
        const result = data as { status?: string } | null;
        if (result?.status === "created") created += 1;
        else if (result?.status === "deduplicated") deduplicated += 1;
    }
    void sourceType;
    return { created, deduplicated };
}

export const syncManager = {
    /** Minimum interval between syncs for a source (provider-appropriate pacing). */
    minIntervalMinutes(sourceType: ContextSourceType): number {
        return MIN_SYNC_INTERVAL_MINUTES[sourceType] ?? 240;
    },

    /**
     * Sync every connected source that is due. OS sources collect on-device;
     * OAuth sources enqueue a server-side sync job. Failures mark the source
     * state honestly (temporary) — existing observations remain valid.
     */
    async syncConnectedSources(): Promise<SyncOutcome[]> {
        const user = await requireAuthenticatedUser();
        const { data: sources, error } = await supabase
            .from("user_data_sources")
            .select("source_type, status, last_synced_at")
            .eq("user_id", user.id);
        if (error) throwDataError(error, copy.errors.connectedSources);
        const connected = (sources ?? []).filter((source: { status: string }) => source.status === "connected");

        const outcomes: SyncOutcome[] = [];
        for (const source of connected as Array<{ source_type: ContextSourceType; last_synced_at: string | null }>) {
            const sourceType = source.source_type;
            const minInterval = this.minIntervalMinutes(sourceType);

            // OS adapter path — bounded, deduplicated on-device collection.
            const adapter = sourceAdapters.find((candidate: ProviderAdapter) => candidate.sourceType === sourceType);
            if (adapter) {
                if (!isDue(source.last_synced_at, minInterval)) {
                    outcomes.push({ sourceType, status: "deferred", created: 0, deduplicated: 0 });
                    continue;
                }
                try {
                    const drafts = await adapter.collect();
                    const { created, deduplicated } = await ingestDrafts(user.id, sourceType, drafts);
                    await supabase.rpc("record_sync_result", {
                        p_user_id: user.id,
                        p_source_type: sourceType,
                        p_status: "ok",
                        p_error: undefined,
                    });
                    outcomes.push({ sourceType, status: "synced", created, deduplicated });
                } catch (error) {
                    const message = error instanceof Error ? error.message : "collection failed";
                    await supabase.rpc("record_sync_result", {
                        p_user_id: user.id,
                        p_source_type: sourceType,
                        p_status: "temporary",
                        p_cursor: null,
                        p_error: message,
                    });
                    outcomes.push({ sourceType, status: "error", created: 0, deduplicated: 0, error: message });
                }
                continue;
            }

            // OAuth path — enqueue a deduplicated server-side sync job.
            if (OAUTH_SOURCE_NAMES[sourceType]) {
                if (!isDue(source.last_synced_at, minInterval)) {
                    outcomes.push({ sourceType, status: "deferred", created: 0, deduplicated: 0 });
                    continue;
                }
                const { data: jobId, error: enqueueError } = await supabase.rpc("enqueue_provider_sync", {
                    p_user_id: user.id,
                    p_source_type: sourceType,
                    p_job_key: `manual:${new Date().toISOString().slice(0, 13)}`, // stable per hour; retries dedupe
                    p_payload: {} as never,
                });
                if (enqueueError) {
                    outcomes.push({ sourceType, status: "error", created: 0, deduplicated: 0, error: enqueueError.message });
                } else {
                    outcomes.push({ sourceType, status: jobId ? "enqueued" : "deferred", created: 0, deduplicated: 0 });
                }
            }
        }
        return outcomes;
    },

    /** One source only (used right after connect = the initial sync). */
    async syncSource(sourceType: ContextSourceType): Promise<SyncOutcome[]> {
        const user = await requireAuthenticatedUser();
        const adapter = sourceAdapters.find((candidate: ProviderAdapter) => candidate.sourceType === sourceType);
        if (adapter) {
            try {
                const drafts = await adapter.collect();
                const { created, deduplicated } = await ingestDrafts(user.id, sourceType, drafts);
                await supabase.rpc("record_sync_result", {
                    p_user_id: user.id,
                    p_source_type: sourceType,
                    p_status: "ok",
                    p_error: undefined,
                });
                return [{ sourceType, status: "synced", created, deduplicated }];
            } catch (error) {
                const message = error instanceof Error ? error.message : "collection failed";
                await supabase.rpc("record_sync_result", {
                    p_user_id: user.id,
                    p_source_type: sourceType,
                    p_status: "temporary",
                    p_cursor: null,
                    p_error: message,
                });
                return [{ sourceType, status: "error", created: 0, deduplicated: 0, error: message }];
            }
        }
        if (OAUTH_SOURCE_NAMES[sourceType]) {
            const { data: jobId, error } = await supabase.rpc("enqueue_provider_sync", {
                p_user_id: user.id,
                p_source_type: sourceType,
                p_job_key: `initial:${new Date().toISOString().slice(0, 13)}`,
                p_payload: { initial: true } as never,
            });
            if (error) return [{ sourceType, status: "error", created: 0, deduplicated: 0, error: error.message }];
            return [{ sourceType, status: jobId ? "enqueued" : "deferred", created: 0, deduplicated: 0 }];
        }
        return [];
    },
};
