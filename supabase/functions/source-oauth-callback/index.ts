// OAuth callback for connected providers.
// Flow: app opens provider authorize URL (via the source-oauth-start function
// or a configured start URL) → provider redirects here with ?code&state →
// this function validates the state (HMAC of userId+source), exchanges the
// code, stores the token in the Supabase Vault, upserts the account link,
// and redirects to aks://source-callback?source=...&status=...&label=...
//
// The mobile app never sees tokens — only the deep-link result.

import { createClient } from "npm:@supabase/supabase-js@2";

import { exchangeCode } from "../_shared/providers/oauth.ts";

const headers = { "Content-Type": "application/json" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

const VALID_SOURCES = new Set(["google_calendar", "google_tasks", "email", "todoist", "github", "slack", "notion"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function appDeepLink(source: string, status: "connected" | "error", label: string): string {
    const params = new URLSearchParams({ source, status, label });
    return `aks://source-callback?${params}`;
}

function htmlRedirect(target: string, message: string): Response {
    // Browsers land here, not the app — redirect via meta refresh + a manual link.
    const safe = target.replace(/"/g, "&quot;");
    const body = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${safe}"><title>Connecting…</title></head><body><p>${message}</p><p><a href="${safe}">Return to Aks</a></p></body></html>`;
    return new Response(body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function readState(requestUrl: URL): Promise<{ userId: string; sourceType: string; signature: string }> {
    const state = requestUrl.searchParams.get("state") ?? "";
    const [userId, sourceType, signature] = state.split(".");
    if (!userId || !sourceType || !signature) throw new Error("INVALID_STATE");
    return { userId, sourceType, signature };
}

/** HMAC-SHA256 as hex using WebCrypto. */
async function hmac(payload: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: { ...headers, "Access-Control-Allow-Origin": "*" } });
    if (request.method !== "GET") return respond({ error: "Method not allowed" }, 405);

    const url = new URL(request.url);
    const providerError = url.searchParams.get("error");
    const stateParam = url.searchParams.get("state") ?? "";
    const [userId = "", sourceType = ""] = stateParam.split(".");

    if (providerError || !userId || !sourceType) {
        const source = sourceType || "unknown";
        return htmlRedirect(appDeepLink(source, "error", ""), "Connection was cancelled.");
    }

    try {
        if (!VALID_SOURCES.has(sourceType) || !uuidPattern.test(userId)) throw new Error("INVALID_STATE");
        const state = await readState(url);

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const stateSecret = Deno.env.get("SOURCE_OAUTH_STATE_SECRET");
        if (!supabaseUrl || !serviceKey || !stateSecret) throw new Error("NOT_CONFIGURED");

        // Verify the state signature before trusting userId/sourceType.
        const expectedSignature = await hmac(`${state.userId}.${state.sourceType}`, stateSecret);
        if (expectedSignature !== state.signature) throw new Error("INVALID_STATE_SIGNATURE");

        const code = url.searchParams.get("code");
        if (!code) throw new Error("MISSING_CODE");

        // Exchange the code for tokens (throws with provider-specific codes).
        const redirectUri = `${url.origin}/functions/v1/source-oauth-callback`;
        const tokens = await exchangeCode(Deno.env, state.sourceType, code, redirectUri);

        const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

        // Store the access token in the Vault (encrypted at rest).
        const vaultName = `provider-token:${state.userId}:${state.sourceType}`;
        const { data: secretRow, error: vaultError } = await admin.schema("vault").from("secrets").upsert({
            name: vaultName,
            secret: tokens.accessToken,
            description: `Connected provider access token (${state.sourceType})`,
        }, { onConflict: "name" }).select("id").single();
        if (vaultError || !secretRow) throw new Error("VAULT_WRITE_FAILED");

        // Upsert the account link the client and sync dispatcher read.
        const { error: linkError } = await admin.from("user_source_accounts").upsert({
            user_id: state.userId,
            source_type: state.sourceType,
            status: "connected",
            provider_account_label: tokens.label.slice(0, 120),
            token_ref: vaultName,
            last_synced_at: null,
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,source_type" });
        if (linkError) throw new Error("LINK_WRITE_FAILED");

        // Best-effort: mark the registry row connected so observations can flow.
        await admin.from("user_data_sources").upsert({
            user_id: state.userId,
            source_type: state.sourceType,
            status: "connected",
            permission_state: "granted",
            platform_support: "supported",
        }, { onConflict: "user_id,source_type" });

        return htmlRedirect(appDeepLink(state.sourceType, "connected", tokens.label), "Connected. You can close this page.");
    } catch (error) {
        const message = (error as Error).message;
        const known = message.split(":")[0];
        const source = stateParam.split(".")[1] ?? "unknown";
        // Never echo provider secrets or full errors to the URL.
        return htmlRedirect(appDeepLink(source, "error", ""), `Connection failed (${known}). You can try again in Aks.`);
    }
});
