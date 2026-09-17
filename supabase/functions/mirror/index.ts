import { createClient } from "npm:@supabase/supabase-js@2";

import { processMirrorTurn } from "../_shared/mirror/mirror.core.ts";
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
        const repository = createMirrorRepository(userClient, adminClient, user.id);
        const memoryRepository = createMemoryRepository(userClient, adminClient, user.id);
        const patternRepository = createPatternRepository(userClient, adminClient, user.id);
        return respond(await processMirrorTurn({ repository, memoryRepository, patternRepository, conversationId: body.conversationId, userMessageId: body.userMessageId }));
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "";
        if (errorMessage === "ATTEMPTS_EXHAUSTED") return respond({ error: { code: "ATTEMPTS_EXHAUSTED", message: "This response can no longer be retried." } }, 409);
        if (errorMessage === "RATE_LIMITED") return respond({ error: { code: "RATE_LIMITED", message: "Please wait a moment before trying again." } }, 429);
        if (["CONVERSATION_UNAVAILABLE", "MESSAGE_UNAVAILABLE"].includes(errorMessage)) return respond({ error: { code: "NOT_FOUND", message: "This conversation is unavailable." } }, 404);
        if (errorMessage === "MESSAGE_TOO_LARGE") return respond({ error: { code: "INVALID_REQUEST", message: "That message is too long." } }, 400);
        const code = errorMessage === "INVALID_AI_RESPONSE" ? "INVALID_AI_OUTPUT" : "AI_UNAVAILABLE";
        return respond({ error: { code, message: "Aks couldn't process that right now." } }, 503);
    }
});
