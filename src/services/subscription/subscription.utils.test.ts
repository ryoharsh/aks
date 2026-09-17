import { describe, expect, it } from "vitest";

import type {
    CustomerInfo,
    PurchasesOfferings,
    PurchasesPackage,
} from "react-native-purchases";

import {
    describeSubscriptionPeriod,
    deriveSubscriptionPlan,
    deriveSubscriptionState,
    deriveSubscriptionStatus,
    isPurchaseCancelledError,
    normalizeOfferings,
    normalizeOption,
    normalizeSubscriptionError,
    titleFromPackageType,
} from "./subscription.utils";

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

function makePackage(
    identifier: string,
    packageType: string,
    priceText = "$4.99",
    period: string | null = null,
): PurchasesPackage {
    return {
        identifier,
        packageType,
        product: {
            identifier,
            priceString: priceText,
            subscriptionPeriod: period,
        },
    } as unknown as PurchasesPackage;
}

function offeringsWith(
    current: PurchasesPackage[] | null,
    all?: Record<string, PurchasesPackage[]>,
): PurchasesOfferings {
    return {
        current: current
            ? { identifier: "current", availablePackages: current }
            : null,
        all: all
            ? Object.fromEntries(
                  Object.entries(all).map(([id, packages]) => [
                      id,
                      { identifier: id, availablePackages: packages },
                  ]),
              )
            : {},
    } as unknown as PurchasesOfferings;
}

describe("describeSubscriptionPeriod", () => {
    it("maps single-unit periods", () => {
        expect(describeSubscriptionPeriod("P1M")).toBe("per month");
        expect(describeSubscriptionPeriod("P1Y")).toBe("per year");
        expect(describeSubscriptionPeriod("P1W")).toBe("per week");
        expect(describeSubscriptionPeriod("P1D")).toBe("per day");
    });

    it("maps multi-unit periods", () => {
        expect(describeSubscriptionPeriod("P3M")).toBe("every 3 months");
        expect(describeSubscriptionPeriod("P2Y")).toBe("every 2 years");
    });

    it("returns null for one-time or malformed periods", () => {
        expect(describeSubscriptionPeriod(null)).toBeNull();
        expect(describeSubscriptionPeriod("")).toBeNull();
        expect(describeSubscriptionPeriod("PX")).toBeNull();
        expect(describeSubscriptionPeriod("PT1H")).toBeNull();
    });
});

describe("titleFromPackageType", () => {
    it("maps known package types", () => {
        expect(titleFromPackageType("MONTHLY", "any")).toBe("Monthly");
        expect(titleFromPackageType("ANNUAL", "any")).toBe("Annual");
        expect(titleFromPackageType("WEEKLY", "any")).toBe("Weekly");
        expect(titleFromPackageType("LIFETIME", "any")).toBe("One-time");
        expect(titleFromPackageType("SIX_MONTH", "any")).toBe("6 months");
    });

    it("falls back to a prettified identifier for custom packages", () => {
        expect(titleFromPackageType("CUSTOM", "premium_monthly")).toBe(
            "Premium monthly",
        );
        expect(titleFromPackageType("CUSTOM", "pro")).toBe("Pro");
    });
});

describe("deriveSubscriptionStatus", () => {
    it("active when entitlement is active and renewing", () => {
        const info = customerInfoWith(
            { isActive: true, willRenew: true },
            { isActive: true, willRenew: true },
        );
        expect(deriveSubscriptionStatus(info)).toBe("active");
    });

    it("cancelled when entitlement is active but not renewing", () => {
        const info = customerInfoWith(
            { isActive: true, willRenew: false },
            { isActive: true, willRenew: false },
        );
        expect(deriveSubscriptionStatus(info)).toBe("cancelled");
    });

    it("expired when the entitlement exists but is inactive", () => {
        const info = customerInfoWith(null, { isActive: false, willRenew: false });
        expect(deriveSubscriptionStatus(info)).toBe("expired");
    });

    it("free when the entitlement has never been purchased", () => {
        expect(deriveSubscriptionStatus(null)).toBe("free");
        expect(deriveSubscriptionStatus(customerInfoWith(null, null))).toBe("free");
    });
});

describe("deriveSubscriptionPlan", () => {
    it("returns plan details when the entitlement exists", () => {
        const info = customerInfoWith(
            { isActive: true, willRenew: false },
            {
                isActive: true,
                willRenew: false,
                productIdentifier: "premium_annual",
                expirationDate: "2027-09-17T00:00:00Z",
            },
        );
        expect(deriveSubscriptionPlan(info)).toEqual({
            productIdentifier: "premium_annual",
            expiresAt: "2027-09-17T00:00:00Z",
            willRenew: false,
        });
    });

    it("null when the entitlement has never been purchased", () => {
        expect(deriveSubscriptionPlan(null)).toBeNull();
        expect(deriveSubscriptionPlan(customerInfoWith(null, null))).toBeNull();
    });
});

describe("normalizeOption and normalizeOfferings", () => {
    it("normalizes an option with price and period", () => {
        const option = normalizeOption(makePackage("premium_monthly", "MONTHLY", "$9.99", "P1M"));
        expect(option).toEqual({
            identifier: "premium_monthly",
            title: "Monthly",
            priceText: "$9.99",
            periodText: "per month",
        });
    });

    it("prefers the current offering", () => {
        const result = normalizeOfferings(
            offeringsWith([makePackage("a", "MONTHLY")], {
                other: [makePackage("b", "ANNUAL")],
            }),
        );
        expect(result.offeringIdentifier).toBe("current");
        expect(result.options.map((o) => o.identifier)).toEqual(["a"]);
    });

    it("falls back to the first offering when current is null", () => {
        const result = normalizeOfferings(
            offeringsWith(null, { other: [makePackage("b", "ANNUAL", "$49.99", "P1Y")] }),
        );
        expect(result.offeringIdentifier).toBe("other");
        expect(result.options.map((o) => o.identifier)).toEqual(["b"]);
        expect(result.options[0].periodText).toBe("per year");
    });

    it("returns empty options for null offerings", () => {
        expect(normalizeOfferings(null)).toEqual({
            options: [],
            offeringIdentifier: null,
        });
    });
});

describe("deriveSubscriptionState", () => {
    it("combines status, plan and offerings", () => {
        const state = deriveSubscriptionState(
            customerInfoWith(null, null),
            offeringsWith([makePackage("a", "MONTHLY", "$9.99", "P1M")]),
        );
        expect(state.status).toBe("free");
        expect(state.plan).toBeNull();
        expect(state.options).toHaveLength(1);
    });
});

describe("normalizeSubscriptionError", () => {
    it("passes through SubscriptionError instances", () => {
        const error = new Error("x");
        expect(normalizeSubscriptionError(error) instanceof Error).toBe(true);
    });

    it("detects cancelled purchases by code", () => {
        const result = normalizeSubscriptionError({ code: "1" });
        expect(result.type).toBe("PURCHASE_CANCELLED");
    });

    it("detects cancelled purchases by userCancelled", () => {
        const result = normalizeSubscriptionError({ userCancelled: true });
        expect(result.type).toBe("PURCHASE_CANCELLED");
    });

    it("maps network codes", () => {
        expect(normalizeSubscriptionError({ code: "10" }).type).toBe(
            "NETWORK_ERROR",
        );
        expect(normalizeSubscriptionError({ code: "35" }).type).toBe(
            "NETWORK_ERROR",
        );
    });

    it("maps offering codes", () => {
        expect(normalizeSubscriptionError({ code: "5" }).type).toBe(
            "OFFERING_UNAVAILABLE",
        );
        expect(normalizeSubscriptionError({ code: "32" }).type).toBe(
            "OFFERING_UNAVAILABLE",
        );
    });

    it("maps unknown store codes to STORE_ERROR", () => {
        expect(normalizeSubscriptionError({ code: "4" }).type).toBe(
            "STORE_ERROR",
        );
    });

    it("maps unrecognized errors to UNKNOWN", () => {
        expect(normalizeSubscriptionError({}).type).toBe("UNKNOWN");
        expect(normalizeSubscriptionError(null).type).toBe("UNKNOWN");
        expect(normalizeSubscriptionError("boom").type).toBe("UNKNOWN");
    });
});

describe("isPurchaseCancelledError", () => {
    it("recognizes cancelled errors", () => {
        expect(isPurchaseCancelledError({ code: "1" })).toBe(true);
        expect(isPurchaseCancelledError({ userCancelled: true })).toBe(true);
    });

    it("rejects other errors", () => {
        expect(isPurchaseCancelledError({ code: "10" })).toBe(false);
        expect(isPurchaseCancelledError(null)).toBe(false);
    });
});