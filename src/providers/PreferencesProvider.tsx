import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";

import { useAuth } from "@/hooks/useAuth";
import {
    preferencesService,
    type UserPreferences,
} from "@/services/preferences.service";

type PreferencesContextValue = {
    preferences: UserPreferences;
    loading: boolean;
    error: string | null;
    updatePreferences: (values: Partial<UserPreferences>) => Promise<void>;
    refresh: () => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [preferences, setPreferences] = useState(preferencesService.defaults);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const requestId = useRef(0);

    const refresh = async () => {
        const currentRequest = ++requestId.current;
        if (!user) {
            setPreferences(preferencesService.defaults);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const loaded = await preferencesService.getOrCreate(user.id);
            if (requestId.current === currentRequest) setPreferences(loaded);
            // Device sync only fills the scheduling timezone while the user
            // has no explicit choice, so a manual pick is never overwritten.
            if (!loaded.timezone) void preferencesService.syncNotificationTimezone();
        } catch {
            if (requestId.current === currentRequest) setError("We couldn't load your preferences.");
        } finally {
            if (requestId.current === currentRequest) setLoading(false);
        }
    };

    useEffect(() => {
        void refresh();
    }, [user?.id]);

    const value = useMemo<PreferencesContextValue>(
        () => ({
            preferences,
            loading,
            error,
            refresh,
            updatePreferences: async (values) => {
                if (!user) return;
                const updated = await preferencesService.update(user.id, values);
                setPreferences(updated);
            },
        }),
        [error, loading, preferences, user],
    );

    return (
        <PreferencesContext.Provider value={value}>
            {children}
        </PreferencesContext.Provider>
    );
}

export function usePreferences() {
    const context = useContext(PreferencesContext);
    if (!context) {
        throw new Error("usePreferences must be used inside PreferencesProvider");
    }
    return context;
}
