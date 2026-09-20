// Provider OAuth configuration + token exchange.
// Server-side only: client secrets are read from Edge Function env, tokens are
// stored in the Supabase Vault, and only minimal scopes are requested.

export type ProviderConfig = {
    /** Authorization URL the user's browser opens. */
    authorizeUrl: string;
    /** Token exchange/refresh endpoint. */
    tokenUrl: string;
    /** Minimal OAuth scopes for Aks's observation use case. */
    scopes: string[];
    /** Env var names for this provider's credentials. */
    clientIdEnv: string;
    clientSecretEnv: string;
};

export const PROVIDERS: Record<string, ProviderConfig> = {
    google_calendar: {
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes: ["https://www.googleapis.com/auth/calendar.events.readonly", "https://www.googleapis.com/auth/calendar.readonly"],
        clientIdEnv: "GOOGLE_CLIENT_ID",
        clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    },
    google_tasks: {
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes: ["https://www.googleapis.com/auth/tasks.readonly"],
        clientIdEnv: "GOOGLE_CLIENT_ID",
        clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    },
    // Gmail metadata-only counts (fetchEmailActivity uses messages.list with
    // format=metadata) — the narrowest scope that supports it.
    email: {
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes: ["https://www.googleapis.com/auth/gmail.metadata"],
        clientIdEnv: "GOOGLE_CLIENT_ID",
        clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    },
    todoist: {
        authorizeUrl: "https://todoist.com/oauth/authorize",
        tokenUrl: "https://todoist.com/oauth/access_token",
        scopes: ["data:read"],
        clientIdEnv: "TODOIST_CLIENT_ID",
        clientSecretEnv: "TODOIST_CLIENT_SECRET",
    },
    github: {
        authorizeUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        scopes: ["read:user"],
        clientIdEnv: "GITHUB_CLIENT_ID",
        clientSecretEnv: "GITHUB_CLIENT_SECRET",
    },
    slack: {
        authorizeUrl: "https://slack.com/oauth/v2/authorize",
        tokenUrl: "https://slack.com/api/oauth.v2.access",
        scopes: ["channels:history", "groups:history", "users:read"],
        clientIdEnv: "SLACK_CLIENT_ID",
        clientSecretEnv: "SLACK_CLIENT_SECRET",
    },
    notion: {
        authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
        tokenUrl: "https://api.notion.com/v1/oauth/token",
        scopes: [],
        clientIdEnv: "NOTION_CLIENT_ID",
        clientSecretEnv: "NOTION_CLIENT_SECRET",
    },
};

export const OAUTH_PROVIDERS = new Set(Object.keys(PROVIDERS));

export type TokenExchangeResult = {
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string | null;
    /** Provider account label, e.g. the email — for the user's own recognition. */
    label: string;
};

function providerConfig(sourceType: string): ProviderConfig {
    const config = PROVIDERS[sourceType];
    if (!config) throw new Error(`UNSUPPORTED_PROVIDER:${sourceType}`);
    return config;
}

function requireEnv(env: { get(name: string): string | undefined }, name: string): string {
    const value = env.get(name);
    if (!value) throw new Error(`MISSING_SECRET:${name}`);
    return value;
}

/** Build the provider authorization URL the user's browser should open. */
export function buildAuthorizeUrl(
    env: { get(name: string): string | undefined },
    sourceType: string,
    redirectUri: string,
    state: string,
): string {
    const config = providerConfig(sourceType);
    const params = new URLSearchParams({
        client_id: requireEnv(env, config.clientIdEnv),
        redirect_uri: redirectUri,
        state,
    });
    if (config.scopes.length) params.set("scope", config.scopes.join(" "));
    // Google: offline for refresh tokens; Notion uses owner.user; Slack needs no extra.
    if (config.tokenUrl.includes("googleapis")) params.set("access_type", "offline");
    if (config.tokenUrl.includes("googleapis")) params.set("prompt", "consent");
    if (config.tokenUrl.includes("notion")) params.set("owner", "user");
    params.set("response_type", "code");
    return `${config.authorizeUrl}?${params}`;
}

/** Exchange an authorization code for tokens (per-provider wire formats). */
export async function exchangeCode(
    env: { get(name: string): string | undefined },
    sourceType: string,
    code: string,
    redirectUri: string,
): Promise<TokenExchangeResult> {
    const config = providerConfig(sourceType);
    const clientId = requireEnv(env, config.clientIdEnv);
    const clientSecret = requireEnv(env, config.clientSecretEnv);

    let response: Response;
    if (config.tokenUrl.includes("notion")) {
        const basic = btoa(`${clientId}:${clientSecret}`);
        response = await fetch(config.tokenUrl, {
            method: "POST",
            headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
            body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
        });
    } else {
        const params = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
        });
        response = await fetch(config.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
            body: params,
        });
    }
    if (!response.ok) throw new Error(`TOKEN_EXCHANGE_FAILED:${response.status}`);
    const payload = (await response.json()) as Record<string, unknown>;

    const accessToken = String(payload.access_token ?? "");
    if (!accessToken) throw new Error("TOKEN_EXCHANGE_NO_TOKEN");
    const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : null;
    const label =
        sourceType === "notion"
            ? String((payload.owner as { user?: { name?: string } } | undefined)?.user?.name ?? "Notion workspace")
            : String((payload.user as { email?: string } | undefined)?.email ?? "");

    return {
        accessToken,
        refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : null,
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
        label,
    };
}

/** Refresh an access token; Google-style only (others use long-lived tokens). */
export async function refreshAccessToken(
    env: { get(name: string): string | undefined },
    sourceType: string,
    refreshToken: string,
): Promise<string> {
    const config = providerConfig(sourceType);
    if (!config.tokenUrl.includes("googleapis")) {
        // Notion/Todoist/GitHub/Slack tokens do not expire — return as-is.
        return refreshToken;
    }
    const params = new URLSearchParams({
        client_id: requireEnv(env, config.clientIdEnv),
        client_secret: requireEnv(env, config.clientSecretEnv),
        refresh_token: refreshToken,
        grant_type: "refresh_token",
    });
    const response = await fetch(config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: params,
    });
    if (!response.ok) throw new Error(`TOKEN_REFRESH_FAILED:${response.status}`);
    const payload = (await response.json()) as { access_token?: string };
    if (!payload.access_token) throw new Error("TOKEN_REFRESH_NO_TOKEN");
    return payload.access_token;
}
