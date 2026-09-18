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
import {
    type SubscriptionOption,
    type SubscriptionState,
} from "@/services/subscription/subscription.types";

const EMPTY_STATE: SubscriptionState = {
    status: "unknown",
    isActive: false,
    options: [],
    offeringIdentifier: null,
    plan: null,
};

const REFRESH_THROTTLE_MS = 60_000;

export type SubscriptionContextValue = {
    state: SubscriptionState;
    busy: boolean;
    notice: string | null;
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
        setState((prev) =>
            prev.status === "unknown" ? { ...prev, status: "loading" } : prev,
        );
        let active = true;
        void (async () => {
            try {
                await subscriptionService.initialize(userId);
                const next = await subscriptionService.fetchState();
                if (active) {
                    setState(next);
                    setNotice(null);
                }
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
        };
    }, [authLoading, user?.id]);

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

    const value = useMemo<SubscriptionContextValue>(
        () => ({
            state,
            busy,
            notice,
            purchase,
            restore,
            manage,
            refresh,
            clearNotice,
        }),
        [state, busy, notice, purchase, restore, manage, refresh, clearNotice],
    );

    return (
        <SubscriptionContext.Provider value={value}>
            {children}
        </SubscriptionContext.Provider>
    );
}