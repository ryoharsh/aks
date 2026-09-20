import { useEffect } from "react";
import { AppState } from "react-native";

import { supabase } from "@/lib/supabase";
import { syncManager } from "@/services/context/syncManager";

/**
 * Battery-conscious sync of connected context sources:
 * - only while the app is foregrounded (no background timers, no wake-locks)
 * - at most every 30 minutes (SyncManager's per-source min-intervals apply on
 *   top, so each provider is hit no more often than appropriate)
 * - failures are swallowed here; SyncManager already records honest states.
 */
const SYNC_INTERVAL_MS = 30 * 60 * 1000;

export function useContextSync(): void {
    useEffect(() => {
        let lastSync = 0;
        let inFlight = false;

        const sync = () => {
            if (inFlight) return;
            inFlight = true;
            void syncManager
                .syncConnectedSources()
                .catch(() => undefined)
                .finally(() => {
                    lastSync = Date.now();
                    inFlight = false;
                });
        };

        const maybeSync = () => {
            if (Date.now() - lastSync >= SYNC_INTERVAL_MS) sync();
        };

        // Initial sync shortly after launch (once a session exists).
        const startup = setTimeout(() => {
            supabase.auth
                .getSession()
                .then(({ data: { session } }) => {
                    if (session) sync();
                })
                .catch(() => undefined);
        }, 4000);

        // Sync on foreground transitions, capped by the interval.
        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active") maybeSync();
        });

        return () => {
            clearTimeout(startup);
            subscription.remove();
        };
    }, []);
}
