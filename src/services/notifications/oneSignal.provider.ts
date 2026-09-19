import { Platform } from "react-native";
import { OneSignal, type NotificationClickEvent, type NotificationWillDisplayEvent, OSNotificationPermission, type PushSubscriptionChangedState } from "react-native-onesignal";

import {
    parseNotificationTapPayload,
    type NativePermissionState,
    type NotificationTapResult,
    type PushSubscriptionSnapshot,
} from "./types";

export type OneSignalProviderConfig = { appId: string };

export type OneSignalProviderHandlers = {
    onNotificationOpened: (event: NotificationTapResult) => void;
    onForegroundNotification: (event: NotificationTapResult, preventDefault: () => void) => void;
    onSubscriptionChanged?: (snapshot: PushSubscriptionSnapshot) => void;
    onPermissionChanged?: (granted: boolean) => void;
};

type ListenerCleanup = () => void;

let initializationPromise: Promise<void> | null = null;
let initializationError: Error | null = null;
let initialized = false;
let listenerRegistrationPromise: Promise<ListenerCleanup> | null = null;
let listenerCleanup: ListenerCleanup | null = null;

function toPermissionState(native: OSNotificationPermission | boolean): NativePermissionState {
    if (typeof native === "boolean") return native ? "granted" : "denied";
    switch (native) {
        case OSNotificationPermission.Authorized: return "granted";
        case OSNotificationPermission.Provisional: return "provisional";
        case OSNotificationPermission.Denied: return "denied";
        case OSNotificationPermission.NotDetermined: return "not_determined";
        default: return "denied";
    }
}

export const oneSignalNotificationProvider = {
    async initialize(config: OneSignalProviderConfig): Promise<void> {
        if (Platform.OS === "web") return;
        if (initialized) return;
        if (initializationError) throw initializationError;
        if (!initializationPromise) {
            initializationPromise = (async () => {
                OneSignal.initialize(config.appId);
                await OneSignal.Notifications.permissionNative();
                OneSignal.InAppMessages.setPaused(true);
                initialized = true;
            })().catch((error: unknown) => {
                initializationError = error instanceof Error ? error : new Error(String(error));
                throw initializationError;
            });
        }
        await initializationPromise;
    },

    async login(externalUserId: string): Promise<void> {
        if (Platform.OS === "web") return;
        await requireInitialized();
        OneSignal.login(externalUserId);
    },

    async logout(): Promise<void> {
        if (Platform.OS === "web") return;
        await requireInitialized();
        OneSignal.logout();
    },

    async getPermissionState(): Promise<NativePermissionState> {
        if (Platform.OS === "web") return "unsupported";
        try {
            await requireInitialized();
            return toPermissionState(await OneSignal.Notifications.permissionNative());
        } catch {
            return "unsupported";
        }
    },

    async canRequestPermission(): Promise<boolean> {
        if (Platform.OS === "web") return false;
        try {
            await requireInitialized();
            return await OneSignal.Notifications.canRequestPermission();
        } catch {
            return false;
        }
    },

    async requestPermission(): Promise<NativePermissionState> {
        if (Platform.OS === "web") return "unsupported";
        try {
            await requireInitialized();
            const granted = await OneSignal.Notifications.requestPermission(false);
            return granted ? "granted" : "denied";
        } catch {
            return "denied";
        }
    },

    async getSubscriptionSnapshot(): Promise<PushSubscriptionSnapshot> {
        if (Platform.OS === "web") {
            return { optedIn: false, permission: "unsupported", pushToken: null, subscriptionId: null };
        }
        try {
            await requireInitialized();
            const [permission, optedIn, pushToken, subscriptionId] = await Promise.all([
                this.getPermissionState(),
                OneSignal.User.pushSubscription.getOptedInAsync(),
                OneSignal.User.pushSubscription.getTokenAsync(),
                OneSignal.User.pushSubscription.getIdAsync(),
            ]);
            return { optedIn, permission, pushToken: pushToken ?? null, subscriptionId: subscriptionId ?? null };
        } catch {
            return { optedIn: false, permission: "denied", pushToken: null, subscriptionId: null };
        }
    },

    async addListeners(handlers: OneSignalProviderHandlers): Promise<ListenerCleanup> {
        if (Platform.OS === "web") return () => undefined;
        if (listenerCleanup) return listenerCleanup;
        if (!listenerRegistrationPromise) {
            listenerRegistrationPromise = (async () => {
                await requireInitialized();
                if (listenerCleanup) return listenerCleanup;
                const mapTap = (event: NotificationClickEvent): NotificationTapResult => {
                    const payload = parseNotificationTapPayload(event.notification.additionalData);
                    return payload
                        ? { handled: true, payload }
                        : { handled: false, reason: "invalid_payload" };
                };
                const onClick = (event: NotificationClickEvent) => handlers.onNotificationOpened(mapTap(event));
                const onForeground = (event: NotificationWillDisplayEvent) => {
                    const mapped = parseNotificationTapPayload(event.notification.additionalData);
                    handlers.onForegroundNotification(
                        mapped ? { handled: true, payload: mapped } : { handled: false, reason: "invalid_payload" },
                        () => event.preventDefault(),
                    );
                };
                const onPermission = (granted: boolean) => handlers.onPermissionChanged?.(granted);
                const onSubscription = (event: PushSubscriptionChangedState) => {
                    handlers.onSubscriptionChanged?.({
                        optedIn: event.current.optedIn,
                        permission: "granted",
                        pushToken: event.current.token ?? null,
                        subscriptionId: event.current.id ?? null,
                    });
                };
                OneSignal.Notifications.addEventListener("click", onClick);
                OneSignal.Notifications.addEventListener("foregroundWillDisplay", onForeground);
                OneSignal.Notifications.addEventListener("permissionChange", onPermission);
                OneSignal.User.pushSubscription.addEventListener("change", onSubscription);
                const cleanup = () => {
                    OneSignal.Notifications.removeEventListener("click", onClick);
                    OneSignal.Notifications.removeEventListener("foregroundWillDisplay", onForeground);
                    OneSignal.Notifications.removeEventListener("permissionChange", onPermission);
                    OneSignal.User.pushSubscription.removeEventListener("change", onSubscription);
                    listenerCleanup = null;
                    listenerRegistrationPromise = null;
                };
                listenerCleanup = cleanup;
                return cleanup;
            })().catch((error: unknown) => {
                listenerRegistrationPromise = null;
                throw error;
            });
        }
        return listenerRegistrationPromise;
    },
};

async function requireInitialized(): Promise<void> {
    if (initialized) return;
    if (initializationPromise) return initializationPromise;
    throw initializationError ?? new Error("OneSignal has not been initialized");
}
