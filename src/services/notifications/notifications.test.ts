import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseNotificationTapPayload } from "./types";
import { ONESIGNAL_API_BASE, sendPushToUser, type OneSignalSendResult } from "../../../supabase/functions/_shared/notifications/onesignal.client";

describe("tap payload validation", () => {
    it("accepts a well-formed payload", () => {
        const payload = parseNotificationTapPayload({
            schema_version: 1,
            category: "insights",
            notification_type: "insight",
            source_type: "insight",
            source_id: "30000000-0000-4000-8000-000000000001",
            event_key: "insight:30000000-0000-4000-8000-000000000001",
            route: "InsightDetail",
        });
        expect(payload?.category).toBe("insights");
        expect(payload?.sourceId).toBe("30000000-0000-4000-8000-000000000001");
    });

    it("rejects malformed, unknown-schema, and injection payloads", () => {
        expect(parseNotificationTapPayload(null)).toBeNull();
        expect(parseNotificationTapPayload("string")).toBeNull();
        expect(parseNotificationTapPayload({ schema_version: 2 })).toBeNull();
        expect(parseNotificationTapPayload({ schema_version: 1, category: "../admin" })).toEqual(expect.objectContaining({ category: null, sourceId: null }));
        expect(parseNotificationTapPayload({ schema_version: 1, source_id: "DROP TABLE users" })).toEqual(expect.objectContaining({ sourceId: null }));
    });
});

describe("OneSignal REST client", () => {
    const config = { appId: "app-id", apiKey: "rest-key" };
    const payload = { title: "T", body: "B", data: { event_key: "insight:x", schema_version: 1 } };

    it("posts to the notifications endpoint with external-id targeting and idempotency key", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "os-1" }), { status: 200 }));
        const result = await sendPushToUser(config, "user-uuid", payload, "insight:x", fetchMock as unknown as typeof fetch);
        expect(fetchMock).toHaveBeenCalledWith(`${ONESIGNAL_API_BASE}/notifications`, expect.objectContaining({ method: "POST" }));
        const body = JSON.parse((fetchMock.mock.calls[0] as unknown[])[1] as never as string ? JSON.stringify((fetchMock.mock.calls[0] as unknown[])[1]) : "{}") as { body?: string };
        const parsed = JSON.parse((body as unknown as { body: string }).body ?? "{}");
        expect(parsed.include_aliases).toEqual({ external_id: ["user-uuid"] });
        expect(parsed.idempotency_key).toBe("insight:x");
        expect(parsed.app_id).toBe("app-id");
        expect(result).toEqual({ ok: true, messageId: "os-1", errors: [] });
    });

    it("marks 5xx as retryable and keeps the event identity", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response("boom", { status: 503 }));
        const result = (await sendPushToUser(config, "user-uuid", payload, "insight:x", fetchMock as unknown as typeof fetch)) as Extract<OneSignalSendResult, { ok: false }>;
        expect(result.ok).toBe(false);
        expect(result.retryable).toBe(true);
    });

    it("marks validation errors as non-retryable", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: { invalid_alias: ["user not found"] } }), { status: 400 }));
        const result = (await sendPushToUser(config, "user-uuid", payload, "insight:x", fetchMock as unknown as typeof fetch)) as Extract<OneSignalSendResult, { ok: false }>;
        expect(result.ok).toBe(false);
        expect(result.retryable).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("treats OneSignal error arrays as failures even on HTTP 200", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: ["All included players are not subscribed"] }), { status: 200 }));
        const result = (await sendPushToUser(config, "user-uuid", payload, "insight:x", fetchMock as unknown as typeof fetch)) as Extract<OneSignalSendResult, { ok: false }>;
        expect(result.ok).toBe(false);
        expect(result.retryable).toBe(false);
    });
});

describe("notification service identity lifecycle", () => {
    beforeEach(() => {
        vi.stubEnv("EXPO_PUBLIC_ONESIGNAL_APP_ID", "test-app-id");
        vi.resetModules();
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("initializes once, switches identity on account change, and detaches on logout", async () => {
        const login = vi.fn();
        const logout = vi.fn();
        const init = vi.fn();
        vi.doMock("./oneSignal.provider", () => ({
            oneSignalNotificationProvider: {
                initialize: init,
                login,
                logout,
                getPermissionState: vi.fn().mockResolvedValue("granted"),
                canRequestPermission: vi.fn().mockResolvedValue(true),
                requestPermission: vi.fn().mockResolvedValue("granted"),
                getSubscriptionSnapshot: vi.fn(),
                addListeners: vi.fn().mockReturnValue(() => undefined),
            },
        }));
        const { notificationService } = await import("./notification.service");

        await notificationService.initialize();
        await notificationService.initialize();
        expect(init).toHaveBeenCalledTimes(1);

        await notificationService.setUser("user-a");
        await notificationService.setUser("user-a"); // duplicate is a no-op
        expect(login).toHaveBeenCalledTimes(1);
        expect(login).toHaveBeenCalledWith("user-a");

        await notificationService.setUser("user-b"); // account switch
        expect(login).toHaveBeenLastCalledWith("user-b");
        expect(logout).toHaveBeenCalledTimes(1);

        await notificationService.clearUser();
        expect(logout).toHaveBeenCalledTimes(2);
        expect(notificationService.getExternalUserId()).toBeNull();
    });

    it("waits for initialization before setting a user and shares concurrent initialization", async () => {
        let resolveInitialization: () => void = () => undefined;
        const initialization = new Promise<void>((resolve) => {
            resolveInitialization = resolve;
        });
        const calls: string[] = [];
        vi.doMock("./oneSignal.provider", () => ({
            oneSignalNotificationProvider: {
                initialize: vi.fn(() => initialization.then(() => calls.push("initialized"))),
                login: vi.fn(async () => calls.push("login")),
                logout: vi.fn(),
                getPermissionState: vi.fn(),
                canRequestPermission: vi.fn(),
                requestPermission: vi.fn(),
                getSubscriptionSnapshot: vi.fn(),
                addListeners: vi.fn(),
            },
        }));
        const { notificationService } = await import("./notification.service");

        const first = notificationService.initialize();
        const second = notificationService.initialize();
        const user = notificationService.setUser("user-a");
        await Promise.resolve();
        expect(calls).toEqual([]);
        resolveInitialization();
        await Promise.all([first, second, user]);
        expect(calls).toEqual(["initialized", "login"]);
    });
});

