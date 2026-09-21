import { supabase } from "@/lib/supabase";
import { requireAuthenticatedUser, throwDataError } from "@/repositories/data.repository";
import { permissionManager } from "./permissions";
import { sourceAdapters } from "./adapters";
import { SOURCE_DEFINITIONS, SOURCE_GROUPS, CONNECTABLE_SOURCES, type ContextSourceType, type ObservationDraft, type SourceDefinition, type SourceRecord, type SourceState } from "./types";
import { copy } from "@/constants/copy";

type Row = {
    source_type: ContextSourceType;
    status: "not_connected" | "connected" | "revoked" | "error";
    permission_state: "not_determined" | "granted" | "denied" | "restricted" | "unavailable";
    platform_support: "supported" | "supported_with_conditions" | "not_available" | "policy_restricted";
    mode: string | null;
    last_synced_at: string | null;
    settings: Record<string, unknown>;
};

function mapSource(row: Row): SourceRecord {
    return {
        sourceType: row.source_type,
        status: row.status,
        permissionState: row.permission_state,
        platformSupport: row.platform_support,
        mode: row.mode,
        lastSyncedAt: row.last_synced_at,
        settings: row.settings ?? {},
    };
}

export const contextService = {
    async listSources(): Promise<SourceRecord[]> {
        await requireAuthenticatedUser();
        const { data, error } = await supabase.from("user_data_sources").select("*").order("source_type");
        if (error) throwDataError(error, copy.errors.connectedSources);
        return (data as Row[]).map(mapSource);
    },

    async getStatuses(): Promise<Array<{ sourceType: ContextSourceType; group: SourceDefinition["group"]; record: SourceRecord | null; state: SourceState; runtime: Awaited<ReturnType<typeof permissionManager.getStatus>> }>> {
        const records = await this.listSources().catch(() => [] as SourceRecord[]);
        // Final decision: only the 13 connectable sources are exposed.
        // Removed sources are deleted from the registry — never shown as unavailable.
        // voice_session stays in the registry for the voice pipeline but is not a connected-source row.
        const registry = CONNECTABLE_SOURCES;
        // One entry per registry source, in canonical order — never duplicates,
        // even when no registry rows exist yet for this account.
        // Platform rule: Apple sources show on iOS, Android sources on Android.
        // Visibility rule: anything unavailable is hidden — never shown as unavailable.
        // (platform unsupported, missing module, or runtime error).
        const statuses = (await Promise.all(
            registry.map(async (sourceType) => {
                const runtime = await permissionManager.getStatus(sourceType);
                const record = records.find((candidate) => candidate.sourceType === sourceType) ?? null;
                let state: SourceState = runtime.state;
                if (record?.status === "connected") state = runtime.permissionState === "granted" ? "connected" : "permission_required";
                else if (record?.status === "revoked") state = "revoked";
                else if (record?.status === "not_connected" && runtime.state === "available") {
                    // For OS sources, a granted permission is not yet consent;
                    // for OAuth sources, a linked account IS the consent.
                    state = SOURCE_DEFINITIONS[sourceType].connection === "oauth" ? "connected" : "not_connected";
                }
                else if (SOURCE_DEFINITIONS[sourceType].connection === "oauth" && runtime.state === "available") state = "connected";
                return { sourceType, group: SOURCE_DEFINITIONS[sourceType].group, record, state, runtime };
            }),
        )).filter(
            (status) =>
                status.runtime.platformSupport !== "not_available" &&
                status.runtime.platformSupport !== "policy_restricted" &&
                status.state !== "not_available" &&
                status.state !== "error",
        );
        return statuses;
    },

    /** Statuses grouped in the fixed section order shown on the sources screen. */
    async getGroupedStatuses(): Promise<Array<{ key: SourceDefinition["group"]; label: string; sources: Array<{ sourceType: ContextSourceType; state: SourceState; runtime: Awaited<ReturnType<typeof permissionManager.getStatus>>; lastSyncedAt: string | null }> }>> {
        const statuses = await this.getStatuses();
        return SOURCE_GROUPS.map(({ key, label }) => ({
            key,
            label,
            sources: statuses
                .filter((status) => status.group === key)
                .map(({ sourceType, state, runtime, record }) => ({ sourceType, state, runtime, lastSyncedAt: record?.lastSyncedAt ?? null })),
        })).filter((group) => group.sources.length > 0);
    },

    async connect(sourceType: ContextSourceType, mode?: string): Promise<SourceRecord> {
        const user = await requireAuthenticatedUser();
        const runtime = await permissionManager.getStatus(sourceType);
        if (runtime.platformSupport === "not_available" || runtime.platformSupport === "policy_restricted") {
            throwDataError(new Error("Source unavailable"), copy.errors.sourceUnavailable);
        }
        let permissionState = runtime.permissionState;
        if (permissionState !== "granted") {
            const requested = await permissionManager.request(sourceType);
            permissionState = requested.permissionState;
            if (permissionState !== "granted") {
                throwDataError(new Error("Permission denied"), copy.errors.sourcePermission);
            }
        }
        const { data, error } = await supabase
            .from("user_data_sources")
            .upsert({
                user_id: user.id,
                source_type: sourceType,
                status: "connected",
                permission_state: permissionState,
                platform_support: runtime.platformSupport,
                mode: mode ?? null,
                connected_at: new Date().toISOString(),
                disconnected_at: null,
            }, { onConflict: "user_id,source_type" })
            .select()
            .single();
        if (error) throwDataError(error, copy.errors.sourceConnect);
        return mapSource(data as Row);
    },

    async disconnect(sourceType: ContextSourceType): Promise<void> {
        const user = await requireAuthenticatedUser();
        const { error } = await supabase
            .from("user_data_sources")
            .update({ status: "revoked", disconnected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("user_id", user.id)
            .eq("source_type", sourceType);
        if (error) throwDataError(error, copy.errors.sourceDisconnect);
        // Future collection stops here; stored observations are untouched
        // until the user separately asks to delete imported data.
    },

    async deleteSourceData(sourceType: ContextSourceType): Promise<void> {
        const user = await requireAuthenticatedUser();
        const { error } = await supabase.from("observations").delete().eq("user_id", user.id).eq("source_type", sourceType);
        if (error) throwDataError(error, copy.errors.sourceDelete);
    },

    /** Collect from connected adapters, dedupe through the DB upsert, stamp last sync. */
    async syncConnectedSources(): Promise<{ created: number; deduplicated: number; skipped: number }> {
        const user = await requireAuthenticatedUser();
        const sources = await this.listSources();
        const connectedTypes = new Set(sources.filter((source) => source.status === "connected").map((source) => source.sourceType));
        let created = 0;
        let deduplicated = 0;
        let skipped = 0;

        for (const adapter of sourceAdapters) {
            if (!connectedTypes.has(adapter.sourceType)) continue;
            const drafts = await adapter.collect();
            for (const draft of drafts) {
                const { data, error } = await supabase.rpc("upsert_observation", {
                    p_user_id: user.id,
                    p_source_type: draft.sourceType,
                    p_observation_type: draft.observationType,
                    p_source_event_id: draft.sourceEventId,
                    p_observed_at: draft.observedAt,
                    p_value: draft.value as never,
                    p_confidence: draft.confidence ?? null,
                    p_metadata: (draft.metadata ?? {}) as never,
                });
                if (error) continue; // invalid values are dropped; sync never hard-fails the batch
                const result = data as { status: string };
                if (result?.status === "created") created += 1;
                else if (result?.status === "deduplicated") deduplicated += 1;
                else skipped += 1;
            }
            await supabase
                .from("user_data_sources")
                .update({ last_synced_at: new Date().toISOString() })
                .eq("user_id", user.id)
                .eq("source_type", adapter.sourceType);
        }
        return { created, deduplicated, skipped };
    },

    /** What Aks is actually using right now — powers "What do you have access to?". */
    async accessSummary(): Promise<string[]> {
        const statuses = await this.getStatuses();
        const parts: string[] = [];
        for (const { sourceType, record, runtime } of statuses) {
            if (record?.status === "connected" && runtime.permissionState === "granted") {
                parts.push(`${SOURCE_DEFINITIONS[sourceType].name} (connected)`);
            }
        }
        parts.push("Microphone is only used during active voice conversations.");
        return parts;
    },
};

export type { ObservationDraft };
