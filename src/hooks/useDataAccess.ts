import { useCallback, useEffect, useState } from "react";

import { copy } from "@/constants/copy";
import { useAuth } from "@/hooks/useAuth";
import { contextService } from "@/services/context/context.service";
import { SOURCE_DEFINITIONS, type ContextSourceType, type SourceState } from "@/services/context/types";

export type DataAccessSource = {
    sourceType: ContextSourceType;
    name: string;
    state: SourceState;
    connected: boolean;
    lastSyncedAt: string | null;
};

type DataAccessState = {
    loading: boolean;
    sources: DataAccessSource[];
    error: string | null;
    refresh: () => Promise<void>;
};

/**
 * What Aks can actually access right now. Reads the same source registry the
 * source control center uses, so a disconnected or unavailable source can never
 * be presented as connected (and vice versa).
 */
export function useDataAccess(): DataAccessState {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [sources, setSources] = useState<DataAccessSource[]>([]);
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
            const statuses = await contextService.getStatuses();
            setSources(
                statuses
                    .filter((status) => status.state === "connected" || status.record?.status === "connected")
                    .map(({ sourceType, state, record }) => ({
                        sourceType,
                        name: SOURCE_DEFINITIONS[sourceType].name,
                        state,
                        connected: state === "connected",
                        lastSyncedAt: record?.lastSyncedAt ?? null,
                    })),
            );
        } catch {
            setError(copy.errors.dataAccess);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { loading, sources, error, refresh };
}