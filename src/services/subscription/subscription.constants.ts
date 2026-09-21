export const SUBSCRIPTION_ENTITLEMENT_ID = "premium";

export const SUBSCRIPTION_DISPLAY_NAME = "Aks Premium";

export const SUBSCRIPTIONS_ENABLED_ENV_VAR =
    "EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED" as const;

/**
 * Whether RevenueCat subscriptions gate the app. Enabled by default and only
 * disabled by the explicit string "false" — any other value (including a
 * typo) keeps the gate closed so a misconfigured build can never silently
 * drop billing.
 */
export function isSubscriptionsEnabled(
    env: Record<string, string | undefined> = process.env,
): boolean {
    return env[SUBSCRIPTIONS_ENABLED_ENV_VAR] !== "false";
}

export const SUBSCRIPTIONS_ENABLED = isSubscriptionsEnabled();

/**
 * Development bypass: while the app runs in a development build (Metro, dev
 * client, Expo Go), no subscription is applicable and the access gate stays
 * open. Release builds are unaffected. Backend entitlement checks (if any)
 * are separate — this only controls the client-side gate.
 */
export const SUBSCRIPTION_DEV_BYPASS =
    typeof __DEV__ !== "undefined" && __DEV__;