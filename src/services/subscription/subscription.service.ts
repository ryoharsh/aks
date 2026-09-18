import * as Linking from "expo-linking";
import { Platform } from "react-native";
import Purchases, { type PurchasesPackage } from "react-native-purchases";

import {
    deriveSubscriptionState,
    normalizeSubscriptionError,
} from "./subscription.utils";
import {
    SubscriptionError,
    type SubscriptionOption,
    type SubscriptionState,
} from "./subscription.types";

let configuredApiKey: string | null = null;
let initializedForUserId: string | null = null;

function apiKeyForPlatform(): string | null {
    switch (Platform.OS) {
        case "ios":
            return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? null;
        case "android":
            return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? null;
        case "web":
            return process.env.EXPO_PUBLIC_REVENUECAT_WEB_API_KEY ?? null;
        default:
            return null;
    }
}

function unavailableState(): SubscriptionState {
    return {
        status: "unavailable",
        isActive: false,
        options: [],
        offeringIdentifier: null,
        plan: null,
    };
}

async function findPackage(
    identifier: string,
): Promise<PurchasesPackage | null> {
    const offerings = await Purchases.getOfferings();
    const offering =
        offerings.current ??
        Object.values(offerings.all)[0] ??
        null;
    return (
        offering?.availablePackages.find(
            (pkg) => pkg.identifier === identifier,
        ) ?? null
    );
}

export const subscriptionService = {
    isConfigured(): boolean {
        return apiKeyForPlatform() !== null;
    },

    async initialize(userId: string): Promise<void> {
        const apiKey = apiKeyForPlatform();
        if (!apiKey) {
            throw new SubscriptionError(
                "NOT_CONFIGURED",
                "Subscriptions aren't set up on this device yet.",
            );
        }
        if (configuredApiKey !== apiKey) {
            await Purchases.configure({ apiKey });
            configuredApiKey = apiKey;
        }
        if (initializedForUserId === userId) {
            return;
        }
        await Purchases.logIn(userId);
        initializedForUserId = userId;
    },

    async disassociate(): Promise<void> {
        initializedForUserId = null;
        if (!configuredApiKey) {
            return;
        }
        try {
            await Purchases.logOut();
        } catch {
            // The SDK re-anonymizes on the next cold start; logout is best-effort.
        }
        configuredApiKey = null;
    },

    async fetchState(): Promise<SubscriptionState> {
        if (!apiKeyForPlatform()) {
            return unavailableState();
        }
        const [customerInfo, offerings] = await Promise.all([
            Purchases.getCustomerInfo(),
            Purchases.getOfferings(),
        ]);
        return deriveSubscriptionState(customerInfo, offerings);
    },

    async purchase(option: SubscriptionOption): Promise<SubscriptionState> {
        const pkg = await findPackage(option.identifier);
        if (!pkg) {
            throw new SubscriptionError(
                "OFFERING_UNAVAILABLE",
                "That plan isn't available right now. Please try again in a moment.",
            );
        }
        await Purchases.purchasePackage(pkg);
        return this.fetchState();
    },

    async restore(): Promise<SubscriptionState> {
        await Purchases.restorePurchases();
        return this.fetchState();
    },

    async manage(): Promise<void> {
        if (Platform.OS === "web") {
            const customerInfo = await Purchases.getCustomerInfo();
            const url = customerInfo.managementURL;
            if (!url) {
                throw new SubscriptionError(
                    "MANAGE_UNAVAILABLE",
                    "Subscription management isn't available right now.",
                );
            }
            await Linking.openURL(url);
            return;
        }
        try {
            await Purchases.showManageSubscriptions();
        } catch (error) {
            throw normalizeSubscriptionError(error);
        }
    },
};