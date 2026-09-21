import { useCallback, useEffect, useRef, useState } from "react";

import { copy } from "@/constants/copy";
import { usePagedData } from "./usePagedData";
import { dataEvents } from "@/services/dataEvents";
import { learningsService } from "@/services/learnings.service";
import type { Learning, LearningEvidence } from "@/types/data";
import { useFocusEffect } from "@react-navigation/native";

const loadLearnings = (options: Parameters<typeof learningsService.listLearnings>[0]) => learningsService.listLearnings(options);

export function useLearnings() {
    const page = usePagedData(loadLearnings);
    useEffect(() => dataEvents.subscribe("learnings", () => { void page.refresh(); }), [page.refresh]);
    return page;
}

export function useLearning(id: string) {
    const [learning, setLearning] = useState<Learning | null>(null);
    const [evidence, setEvidence] = useState<LearningEvidence[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const request = useRef(0);
    const refresh = useCallback(async () => {
        const current = ++request.current;
        setLoading(true); setError(null);
        try {
            const [nextLearning, nextEvidence] = await Promise.all([learningsService.getLearning(id), learningsService.listLearningEvidence(id)]);
            if (current === request.current) { setLearning(nextLearning); setEvidence(nextEvidence); }
        } catch { if (current === request.current) setError(copy.errors.learning); }
        finally { if (current === request.current) setLoading(false); }
    }, [id]);
    useEffect(() => { void refresh(); return () => { request.current += 1; }; }, [refresh]);
    useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
    return { learning, evidence, loading, error, refresh };
}
