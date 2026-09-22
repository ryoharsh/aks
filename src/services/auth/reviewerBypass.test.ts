import { describe, expect, it } from "vitest";

import {
    getReviewerCredentials,
    getReviewerEmail,
    isReviewerEmail,
} from "./reviewerBypass";

const REVIEWER = "play-review@example.com";

const envWith = (values: Record<string, string | undefined>) => ({ ...values });

describe("reviewer bypass", () => {
    it("is off when nothing is configured", () => {
        expect(getReviewerEmail(envWith({}))).toBeNull();
        expect(isReviewerEmail(REVIEWER, envWith({}))).toBe(false);
        expect(getReviewerCredentials(REVIEWER, envWith({}))).toBeNull();
    });

    it("normalizes the configured email for comparison", () => {
        const env = envWith({ EXPO_PUBLIC_REVIEWER_EMAIL: "  Play-Review@Example.COM " });
        expect(getReviewerEmail(env)).toBe(REVIEWER);
        expect(isReviewerEmail(REVIEWER, env)).toBe(true);
        expect(isReviewerEmail("someone-else@example.com", env)).toBe(false);
    });

    it("returns credentials only for the reviewer email with a password set", () => {
        const env = envWith({
            EXPO_PUBLIC_REVIEWER_EMAIL: REVIEWER,
            EXPO_PUBLIC_REVIEWER_PASSWORD: "throwaway-password",
        });
        expect(getReviewerCredentials(REVIEWER, env)).toEqual({
            email: REVIEWER,
            password: "throwaway-password",
        });
        expect(getReviewerCredentials("other@example.com", env)).toBeNull();
    });

    it("fails closed when the password is missing or empty", () => {
        const missing = envWith({ EXPO_PUBLIC_REVIEWER_EMAIL: REVIEWER });
        expect(getReviewerCredentials(REVIEWER, missing)).toBeNull();
        const empty = envWith({
            EXPO_PUBLIC_REVIEWER_EMAIL: REVIEWER,
            EXPO_PUBLIC_REVIEWER_PASSWORD: "",
        });
        expect(getReviewerCredentials(REVIEWER, empty)).toBeNull();
    });

    it("never matches when only the password is configured", () => {
        const env = envWith({ EXPO_PUBLIC_REVIEWER_PASSWORD: "throwaway-password" });
        expect(isReviewerEmail(REVIEWER, env)).toBe(false);
        expect(getReviewerCredentials(REVIEWER, env)).toBeNull();
    });
});
