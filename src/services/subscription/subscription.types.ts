export type SubscriptionStatus =
    | "unknown"
    | "loading"
    | "free"
    | "active"
    | "cancelled"
    | "expired"
    | "unavailable"
    | "error";

export type SubscriptionOption = {
    identifier: string;
    title: string;
    priceText: string;
    periodText: string | null;
};

export type SubscriptionPlan = {
    productIdentifier: string | null;
    expiresAt: string | null;
    willRenew: boolean;
};

export type SubscriptionState = {
    status: SubscriptionStatus;
    options: SubscriptionOption[];
    offeringIdentifier: string | null;
    plan: SubscriptionPlan | null;
};

export type SubscriptionErrorType =
    | "NOT_CONFIGURED"
    | "NETWORK_ERROR"
    | "OFFERING_UNAVAILABLE"
    | "PURCHASE_CANCELLED"
    | "STORE_ERROR"
    | "MANAGE_UNAVAILABLE"
    | "UNKNOWN";

export class SubscriptionError extends Error {
    readonly type: SubscriptionErrorType;

    constructor(type: SubscriptionErrorType, message: string) {
        super(message);
        this.name = "SubscriptionError";
        this.type = type;
    }
}