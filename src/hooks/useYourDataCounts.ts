import { useCallback, useEffect, useRef, useState } from "react";

import { yourDataService } from "@/services/yourData.service";
import type { YourDataCounts } from "@/types/data";
import { dataEvents } from "@/services/dataEvents";

export function useYourDataCounts() {
    const [counts, setCounts] = useState<YourDataCounts | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const requestRef = useRef(0);

    const refresh = useCallback(async () => {
        const request = ++requestRef.current;
        setLoading(true);
        setError(null);
        try {
            const nextCounts = await yourDataService.getCounts();
            if (request === requestRef.current) setCounts(nextCounts);
        } catch {
            if (request === requestRef.current) setError("We couldn't load your data summary. Please try again.");
        } finally {
            if (request === requestRef.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
        return () => { requestRef.current += 1; };
    }, [refresh]);
    useEffect(() => {
        const unsubscribe = [
            dataEvents.subscribe("conversations", () => { void refresh(); }),
            dataEvents.subscribe("reflections", () => { void refresh(); }),
            dataEvents.subscribe("checkIns", () => { void refresh(); }),
            dataEvents.subscribe("memories", () => { void refresh(); }),
            dataEvents.subscribe("patterns", () => { void refresh(); }),
            dataEvents.subscribe("experiments", () => { void refresh(); }),
            dataEvents.subscribe("learnings", () => { void refresh(); }),
            dataEvents.subscribe("insights", () => { void refresh(); }),
        ];
        return () => unsubscribe.forEach((remove) => remove());
    }, [refresh]);
    return { counts, loading, error, refresh };
}
