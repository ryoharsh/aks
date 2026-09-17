import { useCallback, useEffect, useRef, useState } from "react";

import { privacyService, type ExportResult } from "@/services/privacy.service";

export type ExportPhase = "idle" | "processing" | "ready" | "error";

type ExportDataState = {
    phase: ExportPhase;
    result: ExportResult | null;
    error: string | null;
    downloading: boolean;
    downloadError: string | null;
    secondsRemaining: number | null;
    requestExport: () => Promise<void>;
    download: () => Promise<void>;
    reset: () => void;
};

export function useExportData(): ExportDataState {
    const [phase, setPhase] = useState<ExportPhase>("idle");
    const [result, setResult] = useState<ExportResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
    const [, forceTick] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (phase === "ready" && result && !timerRef.current) {
            const tick = () => {
                const remaining = Math.max(0, Math.ceil((new Date(result.expiresAt).getTime() - Date.now()) / 1000));
                setSecondsRemaining(remaining);
                forceTick((tick) => tick + 1);
                if (remaining <= 0) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    timerRef.current = null;
                    setPhase("error");
                    setError("The export link has expired. Please request a new export.");
                    setResult(null);
                }
            };
            tick();
            timerRef.current = setInterval(tick, 1000);
        }
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [phase, result]);

    const requestExport = useCallback(async () => {
        setPhase("processing");
        setError(null);
        setDownloadError(null);
        try {
            setResult(await privacyService.requestExport());
            setPhase("ready");
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "The export could not be created. Please try again.");
            setPhase("error");
        }
    }, []);

    const download = useCallback(async () => {
        if (!result) return;
        setDownloading(true);
        setDownloadError(null);
        try {
            await privacyService.downloadExport(result);
        } catch (caught) {
            setDownloadError(caught instanceof Error ? caught.message : "The export could not be downloaded. Please try again.");
        } finally {
            setDownloading(false);
        }
    }, [result]);

    const reset = useCallback(() => {
        setPhase("idle");
        setResult(null);
        setError(null);
        setDownloadError(null);
    }, []);

    return { phase, result, error, downloading, downloadError, secondsRemaining, requestExport, download, reset };
}