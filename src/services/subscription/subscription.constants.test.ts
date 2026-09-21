import { describe, expect, it } from "vitest";

import {
    isSubscriptionsEnabled,
    SUBSCRIPTIONS_ENABLED_ENV_VAR,
} from "./subscription.constants";

describe("isSubscriptionsEnabled", () => {
    it("is enabled by default", () => {
        expect(isSubscriptionsEnabled({})).toBe(true);
    });

    it("stays enabled for any value but the exact string false", () => {
        expect(
            isSubscriptionsEnabled({
                [SUBSCRIPTIONS_ENABLED_ENV_VAR]: "true",
            }),
        ).toBe(true);
        expect(
            isSubscriptionsEnabled({ [SUBSCRIPTIONS_ENABLED_ENV_VAR]: "0" }),
        ).toBe(true);
        expect(
            isSubscriptionsEnabled({
                [SUBSCRIPTIONS_ENABLED_ENV_VAR]: "False",
            }),
        ).toBe(true);
        expect(
            isSubscriptionsEnabled({ [SUBSCRIPTIONS_ENABLED_ENV_VAR]: "" }),
        ).toBe(true);
    });

    it("is disabled only by the exact string false", () => {
        expect(
            isSubscriptionsEnabled({
                [SUBSCRIPTIONS_ENABLED_ENV_VAR]: "false",
            }),
        ).toBe(false);
    });
});
