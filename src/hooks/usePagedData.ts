import { useCallback, useEffect, useRef, useState } from "react";

import type { Page, PageOptions } from "@/types/data";

export function usePagedData<T>(loader: (options: PageOptions) => Promise<Page<T>>) {
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
    const pageRef = useRef(0);
    const requestRef = useRef(0);
    const loadingMoreRef = useRef(false);
    const loadMoreRequestRef = useRef(0);

    const refresh = useCallback(async () => {
        const request = ++requestRef.current;
        loadMoreRequestRef.current += 1;
        loadingMoreRef.current = false;
        setLoadingMore(false);
        setLoading(true);
        setError(null);
        setLoadMoreError(null);
        try {
            const result = await loader({ page: 0, pageSize: 20 });
            if (request !== requestRef.current) return;
            pageRef.current = 0;
            setItems(result.items);
            setHasMore(result.hasMore);
        } catch {
            if (request === requestRef.current) setError("We couldn't load this data. Please try again.");
        } finally {
            if (request === requestRef.current) setLoading(false);
        }
    }, [loader]);

    const loadMore = useCallback(async () => {
        if (loading || loadingMoreRef.current || !hasMore) return;
        const request = requestRef.current;
        const loadMoreRequest = ++loadMoreRequestRef.current;
        loadingMoreRef.current = true;
        setLoadingMore(true);
        setLoadMoreError(null);
        try {
            const nextPage = pageRef.current + 1;
            const result = await loader({ page: nextPage, pageSize: 20 });
            if (request !== requestRef.current) return;
            pageRef.current = nextPage;
            setItems((current) => [...current, ...result.items]);
            setHasMore(result.hasMore);
        } catch {
            if (request === requestRef.current) setLoadMoreError("We couldn't load more data. Please try again.");
        } finally {
            if (loadMoreRequest === loadMoreRequestRef.current) {
                loadingMoreRef.current = false;
                setLoadingMore(false);
            }
        }
    }, [hasMore, loader, loading]);

    useEffect(() => {
        void refresh();
        return () => { requestRef.current += 1; };
    }, [refresh]);

    return { items, loading, loadingMore, hasMore, error, loadMoreError, refresh, loadMore };
}
