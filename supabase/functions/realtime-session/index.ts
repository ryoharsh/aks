import { createClient } from "npm:@supabase/supabase-js@2";

import { createRealtimeVoiceSessionProvider } from "../_shared/ai/realtime/session.provider.ts";
import { buildMirrorContext } from "../_shared/mirror/context.ts";
import { conversationResponseTask } from "../_shared/mirror/prompts.ts";

const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
};

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers });
    if (request.method !== "POST") return respond({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } }, 405);

    try {
        const authorization = request.headers.get("Authorization");
        const url = Deno.env.get("SUPABASE_URL");
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
        if (!authorization || !url || !anonKey) return respond({ error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } }, 401);

        let body: { conversationId?: unknown };
        try {
            body = await request.json();
        } catch {
            return respond({ error: { code: "INVALID_REQUEST", message: "The request could not be processed." } }, 400);
        }
        const conversationId = body.conversationId ?? null;
        if (conversationId !== null && (typeof conversationId !== "string" || !uuidPattern.test(conversationId))) {
            return respond({ error: { code: "INVALID_REQUEST", message: "The request could not be processed." } }, 400);
        }

        const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
        const { data: { user }, error } = await userClient.auth.getUser();
        if (error || !user) return respond({ error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } }, 401);

        let instructions = conversationResponseTask.instructions;
        if (conversationId) {
            const { data: conversation, error: conversationError } = await userClient.from("conversations").select("id, title").eq("id", conversationId).single();
            if (conversationError || !conversation) return respond({ error: { code: "NOT_FOUND", message: "This conversation is unavailable." } }, 404);

            const [recentMessages, recentSignals, activeMemories, supportedPatterns, activeExperiments, relevantLearnings, preferences] = await Promise.all([
                userClient.from("messages").select("role, content, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(12).then((result) => {
                    if (result.error) throw new Error("CONTEXT_UNAVAILABLE");
                    return result.data.reverse().map((message) => ({ role: message.role, content: message.content, createdAt: message.created_at }));
                }),
                userClient.from("signals").select("signal_type, value, observed_at").order("observed_at", { ascending: false }).limit(8).then((result) => {
                    if (result.error) throw new Error("CONTEXT_UNAVAILABLE");
                    return result.data.map((signal) => ({ signalType: signal.signal_type, value: signal.value, observedAt: signal.observed_at }));
                }),
                userClient.from("memories").select("content, memory_type, last_observed_at").eq("status", "active").order("last_observed_at", { ascending: false }).limit(6).then((result) => {
                    if (result.error) throw new Error("CONTEXT_UNAVAILABLE");
                    return result.data.map((memory) => ({ content: memory.content, memoryType: memory.memory_type, lastObservedAt: memory.last_observed_at }));
                }),
                userClient.from("patterns").select("title, description, status, evidence_count, last_observed_at").in("status", ["supported", "possible"]).order("last_observed_at", { ascending: false }).limit(4).then((result) => {
                    if (result.error) throw new Error("CONTEXT_UNAVAILABLE");
                    return result.data.map((pattern) => ({ title: pattern.title, description: pattern.description, status: pattern.status, evidenceCount: pattern.evidence_count, lastObservedAt: pattern.last_observed_at }));
                }),
                userClient.from("experiments").select("title, hypothesis, status, start_date, end_date").eq("status", "active").order("updated_at", { ascending: false }).limit(3).then((result) => {
                    if (result.error) throw new Error("CONTEXT_UNAVAILABLE");
                    return result.data.map((experiment) => ({ title: experiment.title, hypothesis: experiment.hypothesis, status: experiment.status, startDate: experiment.start_date, endDate: experiment.end_date }));
                }),
                userClient.from("learnings").select("title, description, status, confidence").in("status", ["active", "revised"]).order("updated_at", { ascending: false }).limit(3).then((result) => {
                    if (result.error) throw new Error("CONTEXT_UNAVAILABLE");
                    return result.data.map((learning) => ({ title: learning.title, description: learning.description, status: learning.status, confidence: learning.confidence }));
                }),
                userClient.from("user_preferences").select("what_exploring, what_to_notice").maybeSingle().then((result) => {
                    if (result.error) throw new Error("CONTEXT_UNAVAILABLE");
                    return { whatExploring: result.data?.what_exploring ?? [], whatToNotice: result.data?.what_to_notice ?? [] };
                }),
            ]);
            const context = buildMirrorContext({ currentMessage: "", conversation: { title: conversation.title }, recentMessages, recentSignals, activeMemories, supportedPatterns, activeExperiments, relevantLearnings, preferences });
            instructions = `${conversationResponseTask.instructions}\n\nConversation context:\n${JSON.stringify(context)}`;
        }

        const spec = await createRealtimeVoiceSessionProvider().createSession({ instructions });
        return respond({ spec: { conversationId, ...spec } });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "";
        if (errorMessage === "REALTIME_NOT_CONFIGURED") return respond({ error: { code: "REALTIME_NOT_CONFIGURED", message: "Voice conversations aren’t configured for this build yet." } }, 503);
        if (errorMessage === "RATE_LIMITED") return respond({ error: { code: "RATE_LIMITED", message: "Please wait a moment before trying again." } }, 429);
        return respond({ error: { code: "REALTIME_PROVIDER_UNAVAILABLE", message: "Aks couldn’t start the voice conversation right now." } }, 503);
    }
});