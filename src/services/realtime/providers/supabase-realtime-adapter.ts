import { supabase } from "@/lib/supabase";

import type { RealtimeProviderAdapter, RealtimeSessionRequest, RealtimeSessionSpec } from "../types";
import { MirrorRealtimeError, realTimeErrorMessage } from "../types";

type RealtimeSessionFunctionResponse = {
    spec: RealtimeSessionSpec;
};

function isRealtimeSessionSpec(value: unknown): value is RealtimeSessionSpec {
    if (!value || typeof value !== "object") return false;
    const spec = value as Record<string, unknown>;
    return (
        (spec.conversationId === null || typeof spec.conversationId === "string")
        && ["provider", "protocol", "endpoint", "sessionToken", "model", "instructions"].every((key) => typeof spec[key] === "string")
        && (typeof spec.transport === "string")
        && (typeof spec.inputSampleRate === "number")
        && (typeof spec.outputSampleRate === "number")
        && spec.pcmFormat === "pcm16"
    );
}

async function functionErrorContext(payload: { error?: { code?: unknown; message?: unknown } }): Promise<{ code?: string }> {
    const code = typeof payload.error?.code === "string" ? payload.error.code : undefined;
    return { code };
}

export function createSupabaseRealtimeAdapter(): RealtimeProviderAdapter {
    return {
        async createSession(request: RealtimeSessionRequest) {
            const { data, error } = await supabase.functions.invoke<RealtimeSessionFunctionResponse>("realtime-session", {
                body: { conversationId: request.conversationId },
            });
            if (error) {
                const context = (error as { context?: Response }).context;
                if (context) {
                    try {
                        const payload = await context.clone().json() as { error?: { code?: string; message?: string } };
                        const { code } = await functionErrorContext(payload);
                        if (code === "REALTIME_NOT_CONFIGURED") {
                            throw new MirrorRealtimeError("REALTIME_NOT_CONFIGURED", false, realTimeErrorMessage("REALTIME_NOT_CONFIGURED"));
                        }
                        if (code === "NOT_FOUND" || code === "INVALID_REQUEST") {
                            throw new MirrorRealtimeError("REALTIME_SESSION_UNAVAILABLE", false, realTimeErrorMessage("REALTIME_SESSION_UNAVAILABLE"));
                        }
                        if (code === "RATE_LIMITED") {
                            throw new MirrorRealtimeError("REALTIME_SESSION_UNAVAILABLE", true, realTimeErrorMessage("REALTIME_SESSION_UNAVAILABLE"));
                        }
                        throw new MirrorRealtimeError("REALTIME_PROVIDER_ERROR", true, payload.error?.message ?? realTimeErrorMessage("REALTIME_PROVIDER_ERROR"));
                    } catch (parsed) {
                        if (parsed instanceof MirrorRealtimeError) throw parsed;
                    }
                }
                throw new MirrorRealtimeError("REALTIME_PROVIDER_ERROR", true, realTimeErrorMessage("REALTIME_PROVIDER_ERROR"));
            }
            if (!data || !isRealtimeSessionSpec(data.spec) || !data.spec.sessionToken) {
                throw new MirrorRealtimeError("REALTIME_PROVIDER_ERROR", false, realTimeErrorMessage("REALTIME_PROVIDER_ERROR"));
            }
            return data.spec;
        },
    };
}

let cachedAdapter: RealtimeProviderAdapter | null = null;

export function getRealtimeProviderAdapter(): RealtimeProviderAdapter {
    if (!cachedAdapter) cachedAdapter = createSupabaseRealtimeAdapter();
    return cachedAdapter;
}