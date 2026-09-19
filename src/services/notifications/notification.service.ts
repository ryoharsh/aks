import { oneSignalNotificationProvider } from "./oneSignal.provider";
import { type NotificationCategory, type PushSubscriptionSnapshot } from "./types";

/**
 * Provider-neutral notification service. Aks code interacts only with this
 * module; OneSignal specifics stay inside the provider adapter.
 */
export type NotificationServiceState = {
    initialized: boolean;
    externalUserId: string | null;
};

let initialized = false;
let currentExternalUserId: string | null = null;
let initializationPromise: Promise<void> | null = null;
let initializationError: Error | null = null;

function requireAppId(): string | null {
    const appId = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID;
    return appId && appId.trim().length > 0 ? appId.trim() : null;
}

export const notificationService = {
    /** Initialize OneSignal exactly once for the app process. Safe to call repeatedly. */
    async initialize(): Promise<void> {
        const appId = requireAppId();
        if (!appId || initialized) return;
        if (!initializationPromise) {
            initializationPromise = Promise.resolve().then(() => oneSignalNotificationProvider.initialize({ appId })).then(() => {
                initialized = true;
            }).catch((error: unknown) => {
                initializationError = error instanceof Error ? error : new Error(String(error));
                throw initializationError;
            });
        }
        await initializationPromise;
    },

    isInitialized() {
        return initialized;
    },

    getInitializationError(): Error | null {
        return initializationError;
    },

    /** Associate the authenticated Aks user with the OneSignal identity. */
    async setUser(userId: string): Promise<void> {
        if (currentExternalUserId === userId) return;
        try {
            await this.initialize();
            // An explicit logout before switching prevents any leftover state
            // from the previous account carrying into the new identity.
            if (currentExternalUserId) await oneSignalNotificationProvider.logout();
            await oneSignalNotificationProvider.login(userId);
            currentExternalUserId = userId;
        } catch {
            // Identity sync retries on the next auth change.
        }
    },

    /** Detach the OneSignal identity so account A's device never receives account B's notifications. */
    async clearUser(): Promise<void> {
        if (!currentExternalUserId) return;
        try {
            await this.initialize();
            await oneSignalNotificationProvider.logout();
        } finally {
            currentExternalUserId = null;
        }
    },

    getExternalUserId(): string | null {
        return currentExternalUserId;
    },

    async getPermissionState() {
        await this.initialize();
        return oneSignalNotificationProvider.getPermissionState();
    },

    async canRequestPermission(): Promise<boolean> {
        await this.initialize();
        return oneSignalNotificationProvider.canRequestPermission();
    },

    async requestPermission() {
        await this.initialize();
        return oneSignalNotificationProvider.requestPermission();
    },

    async getSubscriptionSnapshot(): Promise<PushSubscriptionSnapshot> {
        await this.initialize();
        return oneSignalNotificationProvider.getSubscriptionSnapshot();
    },

    /** Ask the OS for permission only when not yet determined; never re-prompts after denial. */
    async ensurePermission(): Promise<{ permission: string; requested: boolean }> {
        await this.initialize();
        const permission = await oneSignalNotificationProvider.getPermissionState();
        if (permission === "granted" || permission === "provisional") return { permission, requested: false };
        if (permission !== "not_determined") return { permission, requested: false };
        const canRequest = await oneSignalNotificationProvider.canRequestPermission();
        if (!canRequest) return { permission, requested: false };
        const next = await oneSignalNotificationProvider.requestPermission();
        return { permission: next, requested: true };
    },
};

export type { NotificationCategory, PushSubscriptionSnapshot } from "./types";
