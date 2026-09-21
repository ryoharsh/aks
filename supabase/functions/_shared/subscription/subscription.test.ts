import { describe, expect, it } from "vitest";

import { requireActiveSubscription } from "./subscription.ts";

function adminWith(row: unknown) {
    return {
        from() {
            return {
                select() {
                    return {
                        eq() {
                            return {
                                async maybeSingle() {
                                    return { data: row, error: null };
                                },
                            };
                        },
                    };
                },
            };
        },
    };
}

describe("Subscription gate", () => {
    it("denies without a mirror row by default", async () => {
        const check = await requireActiveSubscription(adminWith(null), "user-1");
        expect(check).toEqual({ ok: false, code: "SUBSCRIPTION_REQUIRED", message: "An active Aks subscription is required." });
    });

    it("allows active rows", async () => {
        const check = await requireActiveSubscription(
            adminWith({ user_id: "user-1", status: "active", expires_at: null }),
            "user-1",
        );
        expect(check).toEqual({ ok: true });
    });

    it("bypasses the gate only for listed dev users", async () => {
        const holder = globalThis as { Deno?: unknown };
        const previous = holder.Deno;
        holder.Deno = { env: { get: () => "user-1, user-2" } };
        try {
            const allowed = await requireActiveSubscription(adminWith(null), "user-2");
            expect(allowed).toEqual({ ok: true });
            const denied = await requireActiveSubscription(adminWith(null), "user-9");
            expect(denied.code).toBe("SUBSCRIPTION_REQUIRED");
        } finally {
            if (previous === undefined) delete holder.Deno;
            else holder.Deno = previous;
        }
    });

    it("allows everyone when the kill-switch is set to false", async () => {
        const holder = globalThis as { Deno?: unknown };
        const previous = holder.Deno;
        holder.Deno = {
            env: {
                get: (key: string) =>
                    key === "EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED" ? "false" : "",
            },
        };
        try {
            const check = await requireActiveSubscription(
                adminWith(null),
                "user-1",
            );
            expect(check).toEqual({ ok: true });
        } finally {
            if (previous === undefined) delete holder.Deno;
            else holder.Deno = previous;
        }
    });

    it("keeps the gate closed for any kill-switch value but false", async () => {
        const holder = globalThis as { Deno?: unknown };
        const previous = holder.Deno;
        holder.Deno = {
            env: {
                get: (key: string) =>
                    key === "EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED" ? "0" : "",
            },
        };
        try {
            const check = await requireActiveSubscription(
                adminWith(null),
                "user-1",
            );
            expect(check.code).toBe("SUBSCRIPTION_REQUIRED");
        } finally {
            if (previous === undefined) delete holder.Deno;
            else holder.Deno = previous;
        }
    });
});
