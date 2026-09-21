import { useCallback, useEffect, useRef, useState } from "react";

import { copy } from "@/constants/copy";
import { usePagedData } from "./usePagedData";
import { memoriesService } from "@/services/memories.service";
import { dataEvents } from "@/services/dataEvents";
import type { Memory, MemoryEvidence } from "@/types/data";

const loadMemories = (options: Parameters<typeof memoriesService.listMemories>[0]) => memoriesService.listMemories(options);

export function useMemories() {
    const page = usePagedData(loadMemories);
    useEffect(() => dataEvents.subscribe("memories", () => { void page.refresh(); }), [page.refresh]);
    return page;
}

export function useMemory(id: string) {
    const [memory, setMemory] = useState<Memory | null>(null);
    const [evidence, setEvidence] = useState<MemoryEvidence[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const request = useRef(0);
    const refresh = useCallback(async () => {
        const current = ++request.current;
        setLoading(true);
        setError(null);
        try {
            const [nextMemory, nextEvidence] = await Promise.all([memoriesService.getMemory(id), memoriesService.listMemoryEvidence(id)]);
            if (current === request.current) { setMemory(nextMemory); setEvidence(nextEvidence); }
        } catch {
            if (current === request.current) setError(copy.errors.memory);
        } finally {
            if (current === request.current) setLoading(false);
        }
    }, [id]);
    useEffect(() => { void refresh(); return () => { request.current += 1; }; }, [refresh]);
    return { memory, evidence, loading, error, refresh };
}
