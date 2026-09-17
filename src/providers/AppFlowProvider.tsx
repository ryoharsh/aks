import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

import { useAuth } from "@/hooks/useAuth";
import { legalService } from "@/services/legal.service";
import { onboardingService } from "@/services/onboarding.service";

export type AppFlowState = "loading" | "onboarding" | "auth" | "legal" | "main";

type AppFlowContextValue = {
    state: AppFlowState;
    error: string | null;
    completeOnboarding: () => Promise<void>;
    acceptLegal: () => Promise<void>;
    retry: () => void;
};

const AppFlowContext = createContext<AppFlowContextValue | null>(null);

export function AppFlowProvider({ children }: { children: ReactNode }) {
    const { loading: authLoading, user } = useAuth();
    const [state, setState] = useState<AppFlowState>("loading");
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let active = true;
        if (authLoading) {
            setState("loading");
            return;
        }

        setState("loading");
        setError(null);
        void (async () => {
            try {
                if (!user) {
                    const completed = await onboardingService.isCompleted();
                    if (active) setState(completed ? "auth" : "onboarding");
                    return;
                }

                const accepted = await legalService.hasCurrentAcceptance(user.id);
                if (active) setState(accepted ? "main" : "legal");
            } catch {
                if (active) {
                    setError("We couldn't finish setting up your account. Please try again.");
                    setState(user ? "legal" : "onboarding");
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [attempt, authLoading, user?.id]);

    const value = useMemo<AppFlowContextValue>(
        () => ({
            state,
            error,
            completeOnboarding: async () => {
                await onboardingService.complete();
                setState("auth");
            },
            acceptLegal: async () => {
                if (!user) return;
                await legalService.acceptCurrent(user.id);
                setState("main");
            },
            retry: () => setAttempt((current) => current + 1),
        }),
        [error, state, user],
    );

    return <AppFlowContext.Provider value={value}>{children}</AppFlowContext.Provider>;
}

export function useAppFlow() {
    const context = useContext(AppFlowContext);
    if (!context) throw new Error("useAppFlow must be used inside AppFlowProvider");
    return context;
}
