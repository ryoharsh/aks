import { createClient } from "npm:@supabase/supabase-js@2";

import { requireActiveSubscription } from "../_shared/subscription/subscription.ts";
import { processObservationPipeline } from "../_shared/mirror/mirror.core.ts";
import { createMirrorRepository } from "../_shared/mirror/mirror.repository.ts";
import { createMemoryRepository } from "../_shared/memory/memory.repository.ts";
import { createPatternRepository } from "../_shared/pattern/pattern.repository.ts";

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
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!authorization || !url || !anonKey || !serviceRoleKey) return respond({ error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } }, 401);

        let body: { conversationId?: unknown; userMessageId?: unknown };
        try {
            body = await request.json();
        } catch {
            return respond({ error: { code: "INVALID_REQUEST", message: "The message could not be processed." } }, 400);
        }
        if (
            typeof body.conversationId !== "string"
            || typeof body.userMessageId !== "string"
            || !uuidPattern.test(body.conversationId)
            || !uuidPattern.test(body.userMessageId)
        ) {
            return respond({ error: { code: "INVALID_REQUEST", message: "The message could not be processed." } }, 400);
        }

        const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
        const { data: { user }, error } = await userClient.auth.getUser();
        if (error || !user) return respond({ error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } }, 401);

        const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
        const subscription = await requireActiveSubscription(adminClient, user.id);
        if (!subscription.ok) return respond({ error: { code: subscription.code, message: subscription.message } }, 402);
        const repository = createMirrorRepository(userClient, adminClient, user.id);
        const memoryRepository = createMemoryRepository(userClient, adminClient, user.id);
        const patternRepository = createPatternRepository(userClient, adminClient, user.id);
        return respond(await processObservationPipeline({ repository, memoryRepository, patternRepository, conversationId: body.conversationId, userMessageId: body.userMessageId }));
    } catch (error) {
        // Failures must surface as errors — never as a 200 success-shape.
        // The client throws on non-2xx, so "no signals" (200 with empty
        // arrays) stays distinguishable from "request failed".
        const errorMessage = error instanceof Error ? error.message : "";
        console.error("[mirror-observe] pipeline failed:", errorMessage || error);
        if (errorMessage === "RATE_LIMITED") return respond({ error: { code: "RATE_LIMITED", message: "Please wait a moment before trying again." } }, 429);
        if (["CONVERSATION_UNAVAILABLE", "MESSAGE_UNAVAILABLE"].includes(errorMessage)) {
            return respond({ error: { code: "NOT_FOUND", message: "The message could not be processed." } }, 404);
        }
        return respond({ error: { code: "OBSERVATION_FAILED", message: "Aks couldn't process that observation right now." } }, 503);
    }
});
