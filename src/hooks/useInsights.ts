import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { usePagedData } from "./usePagedData";
import { dataEvents } from "@/services/dataEvents";
import { insightsService } from "@/services/insights.service";
import type { Insight } from "@/types/data";

const loadInsights = (options: Parameters<typeof insightsService.listInsights>[0]) => insightsService.listInsights(options);

export function useInsights() {
    const page = usePagedData(loadInsights);
    useEffect(() => dataEvents.subscribe("insights", () => { void page.refresh(); }), [page.refresh]);
    return page;
}

export function useInsight(id: string) {
    const [insight, setInsight] = useState<Insight | null>(null);
    const [sources, setSources] = useState<Awaited<ReturnType<typeof insightsService.getInsightSources>> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const request = useRef(0);
    const refresh = useCallback(async () => {
        const current = ++request.current;
        setLoading(true); setError(null);
        try {
            const nextInsight = await insightsService.getInsight(id);
            const nextSources = nextInsight ? await insightsService.getInsightSources(nextInsight) : null;
            if (current === request.current) { setInsight(nextInsight); setSources(nextSources); }
        } catch { if (current === request.current) setError("We couldn't load this insight."); }
        finally { if (current === request.current) setLoading(false); }
    }, [id]);
    useEffect(() => { void refresh(); return () => { request.current += 1; }; }, [refresh]);
    useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
    return { insight, sources, loading, error, refresh };
}
