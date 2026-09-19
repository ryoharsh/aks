import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export function createReflectionRepository(userClient: SupabaseClient, adminClient: SupabaseClient, userId: string) {
    return {
        async findByVoiceRequestId(userId: string, requestId: string) {
            const { data, error } = await adminClient
                .from("reflections")
                .select("id, created_at")
                .eq("user_id", userId)
                .contains("metadata", { voice_request_id: requestId })
                .limit(1);
            if (error || !data?.length) return null;
            return { id: data[0].id as string, createdAt: data[0].created_at as string };
        },
        async saveReflection(content: string, metadata: Record<string, unknown> = {}) {
            const { data, error } = await adminClient.from("reflections").insert({ user_id: userId, content, metadata }).select("id, created_at").single();
            if (error) throw new Error("REFLECTION_PERSISTENCE_FAILED");
            return { id: data.id as string, createdAt: data.created_at as string };
        },
        async getReflection(reflectionId: string) {
            const { data, error } = await userClient.from("reflections").select("id, content, created_at").eq("id", reflectionId).single();
            if (error) throw new Error("REFLECTION_UNAVAILABLE");
            return { id: data.id as string, content: data.content as string, createdAt: data.created_at as string };
        },
        async getSignalsForSource(sourceType: "reflection", sourceId: string) {
            const { data, error } = await userClient.from("signals").select("id, signal_type, value, confidence, observed_at").eq("source_type", sourceType).eq("source_id", sourceId);
            if (error) throw new Error("SIGNAL_CONTEXT_UNAVAILABLE");
            return data.map((signal) => ({ id: signal.id, signalType: signal.signal_type, value: signal.value, confidence: signal.confidence, observedAt: signal.observed_at }));
        },
        async saveSignals(input: { sourceId: string; observedAt: string; signals: Array<{ signalType: string; value: Record<string, unknown>; confidence: number | null }> }) {
            const { data, error } = await adminClient.from("signals").upsert(
                input.signals.map((signal) => ({ user_id: userId, source_type: "reflection" as const, source_id: input.sourceId, signal_type: signal.signalType, value: signal.value, confidence: signal.confidence, observed_at: input.observedAt })),
                // Plain ON CONFLICT DO NOTHING so the partial unique index
                // (signals_source_signal_unique_idx) deduplicates retries.
                { ignoreDuplicates: true },
            ).select("id, signal_type, value, confidence, observed_at");
            if (error) throw new Error("SIGNAL_PERSISTENCE_FAILED");
            return data.map((signal) => ({ id: signal.id, signalType: signal.signal_type, value: signal.value, confidence: signal.confidence, observedAt: signal.observed_at }));
        },
        async claimRun(input: { reflectionId: string; task: string }) {
            const { data, error } = await adminClient.rpc("claim_reflection_ai_run", { run_user_id: userId, run_reflection_id: input.reflectionId, run_task: input.task });
            if (error || !data) {
                if (error?.message?.includes("MIRROR_ATTEMPTS_EXHAUSTED")) throw new Error("ATTEMPTS_EXHAUSTED");
                if (error?.message?.includes("MIRROR_RATE_LIMITED") || error?.message?.includes("MIRROR_IN_PROGRESS")) throw new Error("RATE_LIMITED");
                throw new Error("AI_RUN_UNAVAILABLE");
            }
            return data as { id: string; status: string };
        },
        async updateRun(id: string, values: Record<string, unknown>) {
            const { error } = await adminClient.from("ai_runs").update(values).eq("id", id);
            if (error) throw new Error("AI_RUN_UPDATE_FAILED");
        },
        async reconcileRun(reflectionId: string, task: string) {
            const { error } = await adminClient.from("ai_runs").update({ status: "succeeded", error_code: null, completed_at: new Date().toISOString() }).eq("reflection_id", reflectionId).eq("task", task);
            if (error) throw new Error("AI_RUN_UPDATE_FAILED");
        },
    };
}

export type ReflectionDataRepository = ReturnType<typeof createReflectionRepository>;
