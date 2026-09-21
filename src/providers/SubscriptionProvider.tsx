import {
    useState,
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    type PropsWithChildren,
} from "react";
import { AppState } from "react-native";

import { useAuth } from "@/hooks/useAuth";
import { subscriptionService } from "@/services/subscription/subscription.service";
import { normalizeSubscriptionError } from "@/services/subscription/subscription.utils";
import { SUBSCRIPTIONS_ENABLED } from "@/services/subscription/subscription.constants";
import {
    type SubscriptionOption,
    type SubscriptionState,
    type SubscriptionStatus,
} from "@/services/subscription/subscription.types";

const EMPTY_STATE: SubscriptionState = {
    status: "unknown",
    isActive: false,
    options: [],
    offeringIdentifier: null,
    plan: null,
};

// Reported while subscriptions are disabled: the app runs without
// limitations and RevenueCat is never contacted.
const DISABLED_ACTIVE_STATE: SubscriptionState = {
    status: "active",
    isActive: true,
    options: [],
    offeringIdentifier: null,
    plan: null,
};

const REFRESH_THROTTLE_MS = 60_000;

export type SubscriptionContextValue = {
    state: SubscriptionState;
    busy: boolean;
    notice: string | null;
    /** Current RevenueCat-derived status (`premium` entitlement). */
    status: SubscriptionStatus;
    /** Trial active OR paid subscription active. The app-wide access flag. */
    isActive: boolean;
    /** True while the entitlement state has not resolved yet. */
    isLoading: boolean;
    /** Non-null only when `status === "error"`. */
    error: string | null;
    purchase: (option: SubscriptionOption) => Promise<void>;
    restore: () => Promise<void>;
    manage: () => Promise<void>;
    refresh: () => Promise<void>;
    clearNotice: () => void;
};

export const SubscriptionContext =
    createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: PropsWithChildren) {
    const { user, loading: authLoading } = useAuth();
    const [state, setState] = useState<SubscriptionState>(EMPTY_STATE);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    const userIdRef = useRef<string | null>(null);
    const lastRefreshRef = useRef(0);

    const refresh = useCallback(async () => {
        const userId = userIdRef.current;
        if (!userId) {
            return;
        }
        if (!SUBSCRIPTIONS_ENABLED) {
            setState(DISABLED_ACTIVE_STATE);
            return;
        }
        try {
            const next = await subscriptionService.fetchState();
            setState(next);
        } catch (error) {
            setState((prev) => ({ ...prev, status: "error" }));
            setNotice(normalizeSubscriptionError(error).message);
        }
    }, []);

    const refreshThrottled = useCallback(async () => {
        const now = Date.now();
        if (now - lastRefreshRef.current < REFRESH_THROTTLE_MS) {
            return;
        }
        lastRefreshRef.current = now;
        await refresh();
    }, [refresh]);

    useEffect(() => {
        if (authLoading) {
            return;
        }
        const userId = user?.id ?? null;
        if (!userId) {
            userIdRef.current = null;
            setState(EMPTY_STATE);
            setNotice(null);
            void subscriptionService.disassociate();
            return;
        }
        userIdRef.current = userId;
        if (!SUBSCRIPTIONS_ENABLED) {
            setState(DISABLED_ACTIVE_STATE);
            setNotice(null);
            return;
        }
        setState((prev) =>
            prev.status === "unknown" ? { ...prev, status: "loading" } : prev,
        );
        let active = true;
        let unsubscribe: (() => void) | null = null;
        void (async () => {
            try {
                await subscriptionService.initialize(userId);
                const next = await subscriptionService.fetchState();
                if (!active) {
                    return;
                }
                setState(next);
                setNotice(null);
                // Live updates: purchase, restore, renewal, cancellation and
                // expiration refresh state immediately. Guarded by user id so
                // a stale event can never leak into another account.
                unsubscribe = subscriptionService.addCustomerInfoListener(
                    () => {
                        if (userIdRef.current !== userId) {
                            return;
                        }
                        void refresh();
                    },
                );
            } catch (error) {
                if (active) {
                    const normalized = normalizeSubscriptionError(error);
                    setState((prev) => ({
                        ...prev,
                        status: normalized.type === "NOT_CONFIGURED"
                            ? "unavailable"
                            : "error",
                    }));
                    setNotice(normalized.message);
                }
            }
        })();
        return () => {
            active = false;
            unsubscribe?.();
        };
    }, [authLoading, user?.id, refresh]);

    useEffect(() => {
        const subscription = AppState.addEventListener("change", (nextState) => {
            if (nextState === "active") {
                void refreshThrottled();
            }
        });
        return () => {
            subscription.remove();
        };
    }, [refreshThrottled]);

    const purchase = useCallback(async (option: SubscriptionOption) => {
        setBusy(true);
        setNotice(null);
        try {
            const next = await subscriptionService.purchase(option);
            setState(next);
            if (!next.isActive) {
                // The store finished checkout but RevenueCat reports no active
                // entitlement. Without this notice the screen silently returns
                // to the plans list. The common cause is an emulator Test
                // Store purchase, which never reaches the account — those need
                // a device/emulator with the Play Store. Otherwise it can be
                // propagation delay, covered by the live listener + restore.
                setNotice("Checkout finished, but Premium isn't active on your account yet. Emulator Test Store purchases don't activate Premium — use a device with the Play Store. Otherwise wait a moment, then try Restore purchases.");
            }
        } catch (error) {
            setNotice(normalizeSubscriptionError(error).message);
        } finally {
            setBusy(false);
        }
    }, []);

    const restore = useCallback(async () => {
        setBusy(true);
        setNotice(null);
        try {
            const next = await subscriptionService.restore();
            setState(next);
            if (next.status === "free") {
                setNotice("No previous purchases were found to restore.");
            }
        } catch (error) {
            setNotice(normalizeSubscriptionError(error).message);
        } finally {
            setBusy(false);
        }
    }, []);

    const manage = useCallback(async () => {
        setNotice(null);
        try {
            await subscriptionService.manage();
        } catch (error) {
            setNotice(normalizeSubscriptionError(error).message);
        }
    }, []);

    const clearNotice = useCallback(() => setNotice(null), []);

    const status = state.status;
    const isActive = state.isActive;
    const isLoading = status === "unknown" || status === "loading";
    const error = status === "error" ? notice : null;

    const value = useMemo<SubscriptionContextValue>(
        () => ({
            state,
            busy,
            notice,
            status,
            isActive,
            isLoading,
            error,
            purchase,
            restore,
            manage,
            refresh,
            clearNotice,
        }),
        [
            state,
            busy,
            notice,
            status,
            isActive,
            isLoading,
            error,
            purchase,
            restore,
            manage,
            refresh,
            clearNotice,
        ],
    );

    return (
        <SubscriptionContext.Provider value={value}>
            {children}
        </SubscriptionContext.Provider>
    );
}