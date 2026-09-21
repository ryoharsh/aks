import type {
    CustomerInfo,
    PurchasesOfferings,
    PurchasesPackage,
} from "react-native-purchases";

import { SUBSCRIPTION_ENTITLEMENT_ID } from "./subscription.constants";
import {
    SubscriptionError,
    type SubscriptionOption,
    type SubscriptionPlan,
    type SubscriptionState,
    type SubscriptionStatus,
} from "./subscription.types";

const PURCHASES_ERROR_CANCELLED = "1";
const PURCHASES_ERROR_ALREADY_PURCHASED = "6";
const PURCHASES_ERROR_PAYMENT_PENDING = "20";
const NETWORK_ERROR_CODES = new Set(["10", "35"]);
const OFFERING_ERROR_CODES = new Set(["5", "32"]);

type RevenueCatErrorLike = {
    code?: string | number;
    userCancelled?: boolean | null;
};

const PACKAGE_TYPE_TITLES: Record<string, string> = {
    LIFETIME: "One-time",
    ANNUAL: "Annual",
    SIX_MONTH: "6 months",
    THREE_MONTH: "3 months",
    TWO_MONTH: "2 months",
    MONTHLY: "Monthly",
    WEEKLY: "Weekly",
};

export function deriveSubscriptionStatus(
    customerInfo: CustomerInfo | null,
): SubscriptionStatus {
    const activeEntitlement =
        customerInfo?.entitlements.active[SUBSCRIPTION_ENTITLEMENT_ID];
    if (activeEntitlement?.isActive) {
        return activeEntitlement.willRenew ? "active" : "cancelled";
    }
    if (customerInfo?.entitlements.all[SUBSCRIPTION_ENTITLEMENT_ID]) {
        return "expired";
    }
    return "free";
}

export function deriveSubscriptionPlan(
    customerInfo: CustomerInfo | null,
): SubscriptionPlan | null {
    const entitlement =
        customerInfo?.entitlements.all[SUBSCRIPTION_ENTITLEMENT_ID];
    if (!entitlement) {
        return null;
    }
    return {
        productIdentifier: entitlement.productIdentifier ?? null,
        expiresAt: entitlement.expirationDate,
        willRenew: entitlement.isActive && entitlement.willRenew,
    };
}

export function titleFromPackageType(
    packageType: string,
    identifier: string,
): string {
    const known = PACKAGE_TYPE_TITLES[packageType];
    if (known) {
        return known;
    }
    const pretty = identifier.replace(/[_-]+/g, " ").trim();
    return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

export function describeSubscriptionPeriod(
    period: string | null,
): string | null {
    if (!period) {
        return null;
    }
    const match = /^P(\d+)([wWmMdDyY])$/.exec(period.trim());
    if (!match) {
        return null;
    }
    const count = Number(match[1]);
    const unit = match[2].toUpperCase();
    if (Number.isNaN(count) || count < 1) {
        return null;
    }
    if (count === 1) {
        switch (unit) {
            case "D":
                return "per day";
            case "W":
                return "per week";
            case "M":
                return "per month";
            case "Y":
                return "per year";
        }
    }
    switch (unit) {
        case "D":
            return `every ${count} days`;
        case "W":
            return `every ${count} weeks`;
        case "M":
            return `every ${count} months`;
        case "Y":
            return `every ${count} years`;
    }
    return null;
}

export function normalizeOption(packageInfo: PurchasesPackage): SubscriptionOption {
    const product = packageInfo.product;
    return {
        identifier: packageInfo.identifier,
        title: titleFromPackageType(packageInfo.packageType, packageInfo.identifier),
        priceText: product.priceString,
        periodText: describeSubscriptionPeriod(product.subscriptionPeriod),
    };
}

export function normalizeOfferings(offerings: PurchasesOfferings | null): {
    options: SubscriptionOption[];
    offeringIdentifier: string | null;
} {
    const offering =
        offerings?.current ??
        (offerings ? Object.values(offerings.all)[0] ?? null : null);
    if (!offering) {
        return { options: [], offeringIdentifier: null };
    }
    return {
        options: offering.availablePackages.map(normalizeOption),
        offeringIdentifier: offering.identifier,
    };
}

export function deriveSubscriptionState(
    customerInfo: CustomerInfo | null,
    offerings: PurchasesOfferings | null,
): SubscriptionState {
    const status = deriveSubscriptionStatus(customerInfo);
    const { options, offeringIdentifier } = normalizeOfferings(offerings);
    return {
        status,
        isActive: status === "active" || status === "cancelled",
        options,
        offeringIdentifier,
        plan: deriveSubscriptionPlan(customerInfo),
    };
}

/**
 * App-wide access rule (single global layer — no per-feature gating).
 * `isActive` already encodes "trial active OR paid subscription active":
 * RevenueCat reports an active trial through the same `premium` entitlement,
 * and a cancelled-but-still-valid entitlement stays `isActive` until expiry.
 */
export function hasSubscriptionAccess(state: SubscriptionState): boolean {
    return state.isActive;
}

/**
 * Whether the subscription state has resolved enough to make an access
 * decision. While unknown/loading the app must wait (splash), never guess.
 */
export function isSubscriptionPending(state: SubscriptionState): boolean {
    return state.status === "unknown" || state.status === "loading";
}

/**
 * Whether the user must be routed to the Subscription screen.
 * Only definitive inactive states gate: `free` (never subscribed / trial
 * never started) and `expired` (trial or subscription lapsed).
 * `unavailable` (billing not configured on this device/build) and `error`
 * (transient store failure) fail open to the main app so a misconfigured
 * dev build or offline launch can never brick the app; protected backend
 * operations still verify the subscription server-side.
 */
export function requiresSubscriptionScreen(
    state: SubscriptionState,
): boolean {
    if (state.isActive) {
        return false;
    }
    return state.status === "free" || state.status === "expired";
}

export function isPurchaseCancelledError(error: unknown): boolean {
    if (error instanceof SubscriptionError) {
        return error.type === "PURCHASE_CANCELLED";
    }
    const candidate = error as RevenueCatErrorLike | null | undefined;
    return (
        candidate?.userCancelled === true ||
        String(candidate?.code ?? "") === PURCHASES_ERROR_CANCELLED
    );
}

export function normalizeSubscriptionError(error: unknown): SubscriptionError {
    if (error instanceof SubscriptionError) {
        return error;
    }
    const candidate = error as RevenueCatErrorLike | null | undefined;
    const code =
        candidate && candidate.code != null ? String(candidate.code) : null;
    if (code === PURCHASES_ERROR_CANCELLED || candidate?.userCancelled === true) {
        return new SubscriptionError(
            "PURCHASE_CANCELLED",
            "Checkout was cancelled. Nothing was charged.",
        );
    }
    if (code && NETWORK_ERROR_CODES.has(code)) {
        return new SubscriptionError(
            "NETWORK_ERROR",
            "We couldn't reach the store. Check your connection and try again.",
        );
    }
    if (code && OFFERING_ERROR_CODES.has(code)) {
        return new SubscriptionError(
            "OFFERING_UNAVAILABLE",
            "Plans aren't available right now. Please try again in a moment.",
        );
    }
    if (code === PURCHASES_ERROR_PAYMENT_PENDING) {
        return new SubscriptionError(
            "PAYMENT_PENDING",
            "Your purchase is waiting for confirmation from the store. It will appear here once it's complete.",
        );
    }
    if (code === PURCHASES_ERROR_ALREADY_PURCHASED) {
        return new SubscriptionError(
            "ALREADY_SUBSCRIBED",
            "You're already subscribed to this plan.",
        );
    }
    if (code !== null) {
        return new SubscriptionError(
            "STORE_ERROR",
            "The store couldn't complete your request. Please try again.",
        );
    }
    return new SubscriptionError(
        "UNKNOWN",
        "Something went wrong while handling your subscription. Please try again.",
    );
}