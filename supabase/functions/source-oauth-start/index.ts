// OAuth start: the authenticated app calls this to get the provider
// authorization URL. Returns { authorizeUrl } — the app opens it in a browser.
// State = userId.sourceType.HMAC(userId.sourceType), verified by the callback.

import { createClient } from "npm:@supabase/supabase-js@2";

import { requireActiveSubscription } from "../_shared/subscription/subscription.ts";
import { buildAuthorizeUrl, OAUTH_PROVIDERS } from "../_shared/providers/oauth.ts";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

async function hmac(payload: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    // Must match the callback's hex encoding exactly (padStart).
    return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers });
    if (request.method !== "POST") return respond({ error: { code: "METHOD_NOT_ALLOWED" } }, 405);

    try {
        const authorization = request.headers.get("Authorization");
        const url = Deno.env.get("SUPABASE_URL");
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const stateSecret = Deno.env.get("SOURCE_OAUTH_STATE_SECRET");
        if (!authorization || !url || !anonKey || !serviceRoleKey || !stateSecret) return respond({ error: { code: "NOT_CONFIGURED" } }, 503);

        const userClient = createClient(url, anonKey, {
            global: { headers: { Authorization: authorization } },
            auth: { persistSession: false },
        });
        const { data: { user }, error } = await userClient.auth.getUser();
        if (error || !user) return respond({ error: { code: "UNAUTHORIZED" } }, 401);

        const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
        const subscription = await requireActiveSubscription(adminClient, user.id);
        if (!subscription.ok) return respond({ error: { code: subscription.code, message: subscription.message } }, 402);

        const body = await request.json() as { sourceType?: unknown };
        const sourceType = typeof body.sourceType === "string" ? body.sourceType : "";
        if (!OAUTH_PROVIDERS.has(sourceType)) return respond({ error: { code: "UNSUPPORTED_PROVIDER" } }, 400);

        const signature = await hmac(`${user.id}.${sourceType}`, stateSecret);
        const state = `${user.id}.${sourceType}.${signature}`;
        const redirectUri = `${url.replace(/\/$/, "")}/functions/v1/source-oauth-callback`;
        const authorizeUrl = buildAuthorizeUrl(Deno.env, sourceType, redirectUri, state);
        return respond({ authorizeUrl });
    } catch (error) {
        const message = (error as Error).message.split(":")[0];
        const status = message.startsWith("MISSING_SECRET") ? 503 : 400;
        return respond({ error: { code: message } }, status);
    }
});
