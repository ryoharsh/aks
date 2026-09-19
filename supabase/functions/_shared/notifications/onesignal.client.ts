// Server-side OneSignal REST client. The REST API key never leaves this
// module; it is injected from Deno environment secrets at call time.

export type OneSignalPushPayload = {
    title: string;
    body: string;
    data: Record<string, unknown>;
};

export type OneSignalSendResult =
    | { ok: true; messageId: string | null; errors: string[] }
    | { ok: false; retryable: boolean; errors: string[] };

export type OneSignalClientConfig = {
    appId: string;
    apiKey: string;
};

export const ONESIGNAL_API_BASE = "https://api.onesignal.com";

export function resolveOneSignalConfig(env: { get(key: string): string | undefined }): OneSignalClientConfig | null {
    const appId = env.get("ONESIGNAL_APP_ID");
    const apiKey = env.get("ONESIGNAL_REST_API_KEY");
    if (!appId || !apiKey) return null;
    return { appId, apiKey };
}

export async function sendPushToUser(
    config: OneSignalClientConfig,
    externalUserId: string,
    payload: OneSignalPushPayload,
    eventKey: string,
    fetchImpl: typeof fetch = fetch,
): Promise<OneSignalSendResult> {
    const response = await fetchImpl(`${ONESIGNAL_API_BASE}/notifications`, {
        method: "POST",
        headers: {
            "Authorization": `Basic ${config.apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            app_id: config.appId,
            include_aliases: { external_id: [externalUserId] },
            target_channel: "push",
            headings: { en: payload.title },
            contents: { en: payload.body },
            data: payload.data,
            // OneSignal collapses repeated creates for the same idempotency key.
            idempotency_key: eventKey,
        }),
    });

    const body = await response.json().catch(() => null) as { id?: string; errors?: unknown } | null;

    if (!response.ok) {
        const errors = extractErrors(body);
        // 429 and 5xx are transient; validation errors are not.
        const retryable = response.status === 429 || response.status >= 500;
        return { ok: false, retryable, errors };
    }
    if (body?.errors && (Array.isArray(body.errors) ? body.errors.length > 0 : Object.keys(body.errors).length > 0)) {
        return { ok: false, retryable: false, errors: extractErrors(body) };
    }
    return { ok: true, messageId: body?.id ?? null, errors: [] };
}

function extractErrors(body: { errors?: unknown } | null): string[] {
    if (!body?.errors) return ["unknown_error"];
    if (Array.isArray(body.errors)) return body.errors.map((error) => String(error)).slice(0, 5);
    if (typeof body.errors === "object") return Object.values(body.errors as Record<string, unknown>).flat().map((error) => String(error)).slice(0, 5);
    return [String(body.errors)].slice(0, 5);
}
