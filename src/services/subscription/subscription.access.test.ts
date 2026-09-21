import { describe, expect, it } from "vitest";

import type { CustomerInfo } from "react-native-purchases";

import {
    deriveSubscriptionState,
    hasSubscriptionAccess,
    isSubscriptionPending,
    requiresSubscriptionScreen,
} from "./subscription.utils";
import type { SubscriptionState } from "./subscription.types";

type EntitlementShape = {
    isActive: boolean;
    willRenew: boolean;
    productIdentifier?: string | null;
    expirationDate?: string | null;
};

function customerInfoWith(
    active: EntitlementShape | null,
    all: EntitlementShape | null,
): CustomerInfo {
    return {
        entitlements: {
            active: active ? { premium: active } : {},
            all: all ? { premium: all } : {},
        },
    } as unknown as CustomerInfo;
}

function stateFor(
    active: EntitlementShape | null,
    all: EntitlementShape | null,
): SubscriptionState {
    return deriveSubscriptionState(customerInfoWith(active, all), null);
}

function stateWithStatus(
    status: SubscriptionState["status"],
    isActive: boolean,
): SubscriptionState {
    return {
        status,
        isActive,
        options: [],
        offeringIdentifier: null,
        plan: null,
    };
}

describe("app-wide subscription access (single global layer)", () => {
    it("active trial grants full app access", () => {
        // A trial is reported through the same `premium` entitlement.
        const state = stateFor(
            { isActive: true, willRenew: true },
            { isActive: true, willRenew: true },
        );
        expect(state.status).toBe("active");
        expect(hasSubscriptionAccess(state)).toBe(true);
        expect(requiresSubscriptionScreen(state)).toBe(false);
    });

    it("active monthly subscription grants full app access", () => {
        const state = stateFor(
            {
                isActive: true,
                willRenew: true,
                productIdentifier: "aks_premium_monthly",
                expirationDate: "2026-10-20T00:00:00Z",
            },
            {
                isActive: true,
                willRenew: true,
                productIdentifier: "aks_premium_monthly",
                expirationDate: "2026-10-20T00:00:00Z",
            },
        );
        expect(hasSubscriptionAccess(state)).toBe(true);
        expect(requiresSubscriptionScreen(state)).toBe(false);
    });

    it("active yearly subscription grants full app access", () => {
        const state = stateFor(
            {
                isActive: true,
                willRenew: true,
                productIdentifier: "aks_premium_yearly",
                expirationDate: "2027-09-20T00:00:00Z",
            },
            {
                isActive: true,
                willRenew: true,
                productIdentifier: "aks_premium_yearly",
                expirationDate: "2027-09-20T00:00:00Z",
            },
        );
        expect(hasSubscriptionAccess(state)).toBe(true);
        expect(requiresSubscriptionScreen(state)).toBe(false);
    });

    it("monthly and yearly grant the same premium access (no tiers)", () => {
        const monthly = stateFor(
            { isActive: true, willRenew: true },
            { isActive: true, willRenew: true },
        );
        const yearly = stateFor(
            { isActive: true, willRenew: true },
            { isActive: true, willRenew: true },
        );
        expect(hasSubscriptionAccess(monthly)).toBe(
            hasSubscriptionAccess(yearly),
        );
        expect(requiresSubscriptionScreen(monthly)).toBe(
            requiresSubscriptionScreen(yearly),
        );
    });

    it("expired trial routes to the Subscription screen", () => {
        const state = stateFor(null, { isActive: false, willRenew: false });
        expect(state.status).toBe("expired");
        expect(hasSubscriptionAccess(state)).toBe(false);
        expect(requiresSubscriptionScreen(state)).toBe(true);
    });

    it("expired subscription routes to the Subscription screen", () => {
        const state = stateFor(null, {
            isActive: false,
            willRenew: false,
            productIdentifier: "aks_premium_monthly",
            expirationDate: "2026-09-01T00:00:00Z",
        });
        expect(hasSubscriptionAccess(state)).toBe(false);
        expect(requiresSubscriptionScreen(state)).toBe(true);
    });

    it("never-subscribed users route to the Subscription screen", () => {
        const state = stateFor(null, null);
        expect(state.status).toBe("free");
        expect(hasSubscriptionAccess(state)).toBe(false);
        expect(requiresSubscriptionScreen(state)).toBe(true);
    });

    it("cancelled but still entitled keeps full access until expiry", () => {
        const state = stateFor(
            { isActive: true, willRenew: false },
            { isActive: true, willRenew: false },
        );
        expect(state.status).toBe("cancelled");
        expect(hasSubscriptionAccess(state)).toBe(true);
        expect(requiresSubscriptionScreen(state)).toBe(false);
    });

    it("successful purchase immediately unlocks the app", () => {
        // `purchase()` resolves through `fetchState()`; the resulting state
        // must already grant access — no restart required.
        const afterPurchase = stateFor(
            { isActive: true, willRenew: true },
            { isActive: true, willRenew: true },
        );
        expect(hasSubscriptionAccess(afterPurchase)).toBe(true);
        expect(requiresSubscriptionScreen(afterPurchase)).toBe(false);
    });

    it("successful restore immediately unlocks an eligible account", () => {
        const afterRestore = stateFor(
            { isActive: true, willRenew: true },
            { isActive: true, willRenew: true },
        );
        expect(hasSubscriptionAccess(afterRestore)).toBe(true);
        expect(requiresSubscriptionScreen(afterRestore)).toBe(false);
    });

    it("a failed restore (still free) keeps the gate closed", () => {
        const afterRestore = stateFor(null, null);
        expect(hasSubscriptionAccess(afterRestore)).toBe(false);
        expect(requiresSubscriptionScreen(afterRestore)).toBe(true);
    });

    it("unresolved state waits (splash) instead of guessing", () => {
        for (const status of ["unknown", "loading"] as const) {
            const state = stateWithStatus(status, false);
            expect(isSubscriptionPending(state)).toBe(true);
            expect(requiresSubscriptionScreen(state)).toBe(false);
        }
    });

    it("resolved states never report pending", () => {
        for (const status of [
            "free",
            "active",
            "cancelled",
            "expired",
            "unavailable",
            "error",
        ] as const) {
            expect(
                isSubscriptionPending(stateWithStatus(status, false)),
            ).toBe(false);
        }
    });

    it("unavailable/error fail open on-device (backend still enforces)", () => {
        // Billing unconfigured or a transient store failure must never brick
        // the app; protected Edge Functions verify server-side regardless.
        expect(
            requiresSubscriptionScreen(stateWithStatus("unavailable", false)),
        ).toBe(false);
        expect(
            requiresSubscriptionScreen(stateWithStatus("error", false)),
        ).toBe(false);
    });

    it("switching users resets to pending (no state leak)", () => {
        // The provider resets to EMPTY (unknown) on logout; the gate must
        // treat that as pending, never as the previous user's access.
        const reset = stateWithStatus("unknown", false);
        expect(isSubscriptionPending(reset)).toBe(true);
        expect(hasSubscriptionAccess(reset)).toBe(false);
        expect(requiresSubscriptionScreen(reset)).toBe(false);
    });
});
