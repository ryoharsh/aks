import { beforeEach, describe, expect, it, vi } from "vitest";

const chain = vi.hoisted(() => {
    const make = () => {
        const promise = {
            select: make,
            eq: make,
            single: make,
            upsert: make,
            then: undefined as unknown,
        };
        // Await-able chain: resolves to the configured result.
        promise.then = (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled);
        return promise;
    };
    let result: { data: unknown; error: unknown } = { data: null, error: null };
    const builder = new Proxy({}, {
        get(_target, prop) {
            if (prop === "then") return promiseThen;
            if (prop === "upsert" || prop === "select" || prop === "eq" || prop === "single") {
                return (...args: unknown[]) => {
                    calls.push({ method: String(prop), args });
                    return builder;
                };
            }
            return () => builder;
        },
    });
    const calls: { method: string; args: unknown[] }[] = [];
    const promiseThen = (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled);
    return {
        builder,
        calls,
        setResult: (next: { data: unknown; error: unknown }) => {
            result = next;
        },
        reset: () => {
            calls.length = 0;
        },
    };
});

vi.mock("@/lib/supabase", () => ({ supabase: { from: () => chain.builder } }));

import { preferencesService } from "./preferences.service";

const baseRow = {
    appearance: "system",
    what_exploring: [],
    what_to_notice: [],
    notifications_enabled: true,
    notification_categories: {},
    quiet_hours_enabled: true,
    timezone: null,
    language: null,
};

describe("preferences service language field", () => {
    beforeEach(() => {
        chain.reset();
    });

    it("maps a stored language code into the preference", async () => {
        chain.setResult({ data: { ...baseRow, language: "hi" }, error: null });
        const prefs = await preferencesService.getOrCreate("user-1");
        expect(prefs.language).toBe("hi");
    });

    it("maps an unknown stored code to null instead of trusting it", async () => {
        chain.setResult({ data: { ...baseRow, language: "xx" }, error: null });
        const prefs = await preferencesService.getOrCreate("user-1");
        expect(prefs.language).toBeNull();
    });

    it("maps a missing column value to null", async () => {
        chain.setResult({ data: { ...baseRow, language: null }, error: null });
        const prefs = await preferencesService.getOrCreate("user-1");
        expect(prefs.language).toBeNull();
    });

    it("sends the language in the update payload when provided", async () => {
        chain.setResult({ data: { ...baseRow, language: "hi" }, error: null });
        await preferencesService.update("user-1", { language: "hi" });
        const upsert = chain.calls.find((call) => call.method === "upsert");
        expect(upsert).toBeTruthy();
        expect((upsert!.args[0] as Record<string, unknown>).language).toBe("hi");
    });

    it("omits the language from the payload when not provided", async () => {
        chain.setResult({ data: baseRow, error: null });
        await preferencesService.update("user-1", { timezone: "Asia/Kolkata" });
        const upsert = chain.calls.find((call) => call.method === "upsert");
        expect(upsert).toBeTruthy();
        expect(upsert!.args[0]).not.toHaveProperty("language");
    });

    it("includes language in the shared select list", async () => {
        chain.setResult({ data: baseRow, error: null });
        await preferencesService.getOrCreate("user-1");
        const select = chain.calls.find((call) => call.method === "select");
        expect((select!.args[0] as string)).toContain("language");
    });
});
