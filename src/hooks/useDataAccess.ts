import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { privacyService, type DataSource } from "@/services/privacy.service";

type DataAccessState = {
    loading: boolean;
    sources: DataSource[];
    error: string | null;
    refresh: () => Promise<void>;
};

export function useDataAccess(): DataAccessState {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [sources, setSources] = useState<DataSource[]>([]);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!user) {
            setSources([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            setSources(await privacyService.listDataSources(user.id));
        } catch (caught) {
            const message = caught instanceof Error ? caught.message : "Couldn't load your connected sources. Please try again.";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { loading, sources, error, refresh };
}