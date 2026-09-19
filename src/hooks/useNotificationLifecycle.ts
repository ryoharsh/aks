import { useEffect } from "react";

import { useAuth } from "@/hooks/useAuth";
import { notificationService } from "@/services/notifications/notification.service";
import { oneSignalNotificationProvider, type OneSignalProviderHandlers } from "@/services/notifications/oneSignal.provider";
import { navigationBus } from "@/services/navigationBus";
import type { NotificationTapPayload } from "@/services/notifications/types";

function routeForTap(payload: NotificationTapPayload) {
    const sourceId = payload.sourceId;
    if (!sourceId) return null;
    switch (payload.category) {
        case "insights":
            return { screen: "InsightDetail" as const, params: { insightId: sourceId } };
        case "experiments":
            return { screen: "ExperimentDetail" as const, params: { experimentId: sourceId } };
        default:
            return null;
    }
}

/** Wires OneSignal lifecycle to Aks auth state and notification taps. */
export function useNotificationLifecycle() {
    const { user } = useAuth();

    useEffect(() => {
        void notificationService.initialize().catch(() => undefined);
    }, []);

    useEffect(() => {
        if (!user) {
            void notificationService.clearUser();
            return;
        }
        void notificationService.setUser(user.id);
    }, [user?.id]);

    useEffect(() => {
        const handlers: OneSignalProviderHandlers = {
            onNotificationOpened: (result) => {
                if (!result.handled) return;
                const route = routeForTap(result.payload);
                if (route) navigationBus.requestTimelineNavigation(route);
            },
            onForegroundNotification: (result, preventDefault) => {
                // Aks keeps the open app calm: taps are handled, but we don't
                // add a second visual layer over the Mirror experience.
                void result;
                preventDefault();
            },
        };
        let active = true;
        let cleanup: () => void = () => undefined;
        void oneSignalNotificationProvider.addListeners(handlers).then((remove) => {
            if (active) {
                cleanup = remove;
            } else {
                remove();
            }
        }).catch(() => undefined);
        return () => {
            active = false;
            cleanup();
        };
    }, []);
}
