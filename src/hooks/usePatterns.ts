import { useCallback, useEffect, useRef, useState } from "react";

import { copy } from "@/constants/copy";
import { usePagedData } from "./usePagedData";
import { dataEvents } from "@/services/dataEvents";
import { patternsService } from "@/services/patterns.service";
import type { Pattern, PatternEvidence } from "@/types/data";

const loadPatterns = (options: Parameters<typeof patternsService.listPatterns>[0]) => patternsService.listPatterns(options);

export function usePatterns() {
    const page = usePagedData(loadPatterns);
    useEffect(() => dataEvents.subscribe("patterns", () => { void page.refresh(); }), [page.refresh]);
    return page;
}

export function usePattern(id: string) {
    const [pattern, setPattern] = useState<Pattern | null>(null);
    const [evidence, setEvidence] = useState<PatternEvidence[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const request = useRef(0);
    const refresh = useCallback(async () => {
        const current = ++request.current;
        setLoading(true);
        setError(null);
        try {
            const [nextPattern, nextEvidence] = await Promise.all([patternsService.getPattern(id), patternsService.listPatternEvidence(id)]);
            if (current === request.current) { setPattern(nextPattern); setEvidence(nextEvidence); }
        } catch {
            if (current === request.current) setError(copy.errors.pattern);
        } finally {
            if (current === request.current) setLoading(false);
        }
    }, [id]);
    useEffect(() => { void refresh(); return () => { request.current += 1; }; }, [refresh]);
    return { pattern, evidence, loading, error, refresh };
}
