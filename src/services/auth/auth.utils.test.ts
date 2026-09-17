import { describe, expect, it } from "vitest";

import { AuthError } from "./auth.types";
import { normalizeAuthError, normalizeEmail, normalizeName, toAksUser } from "./auth.utils";

describe("auth utilities", () => {
    it("normalizes and validates email addresses", () => {
        expect(normalizeEmail(" Person@Example.COM ")).toBe("person@example.com");
        expect(() => normalizeEmail("not-an-email")).toThrowError("Invalid email address.");
    });

    it("trims names without imposing arbitrary character rules", () => {
        expect(normalizeName("  Li  ")).toBe("Li");
        expect(() => normalizeName("A")).toThrowError("Please enter your full name.");
    });

    it("maps provider failures to a safe message", () => {
        const normalized = normalizeAuthError(new Error("fetch failed for secret endpoint"));
        expect(normalized).toMatchObject({
            type: "NETWORK_ERROR",
            message: "Check your connection and try again.",
        });
    });

    it("preserves normalized auth errors", () => {
        const error = new AuthError("OAUTH_CANCELLED", "Sign in was cancelled.");
        expect(normalizeAuthError(error)).toBe(error);
    });

    it("maps only identity fields used by Aks", () => {
        const user = toAksUser({
            id: "user-1",
            email: "person@example.com",
            created_at: "2026-09-17T00:00:00Z",
            user_metadata: { full_name: "Person", avatar_url: "https://example.com/avatar" },
            app_metadata: { provider: "github" },
        } as never);

        expect(user).toEqual({
            id: "user-1",
            email: "person@example.com",
            name: "Person",
            avatarUrl: "https://example.com/avatar",
            provider: "github",
            createdAt: "2026-09-17T00:00:00Z",
        });
    });
});
