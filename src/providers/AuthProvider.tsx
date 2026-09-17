import {
    createContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import * as Linking from "expo-linking";
import type { Session, User } from "@supabase/supabase-js";

import { authService } from "@/services/auth/auth.service";
import { normalizeAuthError, toAksUser } from "@/services/auth/auth.utils";
import type { AksUser, AuthProviderName } from "@/services/auth/auth.types";

export type AuthContextValue = {
    session: Session | null;
    user: AksUser | null;
    loading: boolean;
    isAuthenticated: boolean;
    callbackError: string | null;
    clearCallbackError: () => void;
    signInWithMagicLink: (email: string) => Promise<void>;
    signUpWithMagicLink: (name: string, email: string) => Promise<void>;
    signInWithProvider: (provider: AuthProviderName) => Promise<void>;
    updateName: (name: string) => Promise<void>;
    updateAvatar: (avatarUrl: string | null) => Promise<void>;
    signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [callbackError, setCallbackError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        const authSubscription = authService.onAuthStateChange((nextSession) => {
            if (active) setSession(nextSession);
        });

        const handleUrl = async (url: string | null) => {
            if (!url) return;
            try {
                const callbackSession = await authService.exchangeAuthCallback(url);
                if (active && callbackSession) setSession(callbackSession);
            } catch (error) {
                if (active) setCallbackError(normalizeAuthError(error).message);
            }
        };

        const linkSubscription = Linking.addEventListener("url", ({ url }) => {
            void handleUrl(url);
        });

        void (async () => {
            try {
                await handleUrl(await Linking.getInitialURL());
                const restoredSession = await authService.getSession();
                if (active) setSession(restoredSession);
            } catch (error) {
                if (active) setCallbackError(normalizeAuthError(error).message);
            } finally {
                if (active) setLoading(false);
            }
        })();

        return () => {
            active = false;
            linkSubscription.remove();
            authSubscription.data.subscription.unsubscribe();
        };
    }, []);

    const replaceUser = (user: User) => {
        setSession((current) =>
            current ? { ...current, user } : current,
        );
    };

    const value = useMemo<AuthContextValue>(
        () => ({
            session,
            user: toAksUser(session?.user ?? null),
            loading,
            isAuthenticated: Boolean(session),
            callbackError,
            clearCallbackError: () => setCallbackError(null),
            signInWithMagicLink: authService.signInWithMagicLink,
            signUpWithMagicLink: authService.signUpWithMagicLink,
            signInWithProvider: authService.signInWithProvider,
            updateName: async (name) => replaceUser(await authService.updateName(name)),
            updateAvatar: async (avatarUrl) =>
                replaceUser(await authService.updateAvatar(avatarUrl)),
            signOut: authService.signOut,
        }),
        [callbackError, loading, session],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
