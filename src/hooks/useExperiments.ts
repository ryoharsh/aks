import { useCallback, useEffect, useRef, useState } from "react";

import { usePagedData } from "./usePagedData";
import { dataEvents } from "@/services/dataEvents";
import { experimentsService } from "@/services/experiments.service";
import type { Experiment, ExperimentObservation } from "@/types/data";

const loadExperiments = (options: Parameters<typeof experimentsService.listExperiments>[0]) => experimentsService.listExperiments(options);

export function useExperiments() {
    const page = usePagedData(loadExperiments);
    useEffect(() => dataEvents.subscribe("experiments", () => { void page.refresh(); }), [page.refresh]);
    return page;
}

export function useExperiment(id: string) {
    const [experiment, setExperiment] = useState<Experiment | null>(null);
    const [observations, setObservations] = useState<ExperimentObservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const request = useRef(0);
    const refresh = useCallback(async () => {
        const current = ++request.current;
        setLoading(true);
        setError(null);
        try {
            const [nextExperiment, nextObservations] = await Promise.all([experimentsService.getExperiment(id), experimentsService.listObservations(id)]);
            if (current === request.current) { setExperiment(nextExperiment); setObservations(nextObservations); }
        } catch {
            if (current === request.current) setError("We couldn't load this experiment.");
        } finally {
            if (current === request.current) setLoading(false);
        }
    }, [id]);
    useEffect(() => { void refresh(); return () => { request.current += 1; }; }, [refresh]);
    useEffect(() => dataEvents.subscribe("experiments", () => { void refresh(); }), [refresh]);
    return { experiment, observations, loading, error, refresh };
}
