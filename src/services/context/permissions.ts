import { Platform } from "react-native";
import { isOAuthSourceLinked } from "./oauth";
import { SOURCE_DEFINITIONS, type ContextSourceType, type PermissionState, type PlatformSupport, type SourceState } from "./types";

/**
 * Centralized permission manager. The rest of Aks never asks the OS for a
 * context permission directly — it goes through here.
 */
export type PermissionManagerStatus = {
    sourceType: ContextSourceType;
    state: SourceState;
    permissionState: PermissionState;
    platformSupport: PlatformSupport;
    canRequest: boolean;
    canRevoke: boolean;
};

type LocationPermissionModule = {
    requestForegroundPermissionsAsync?: () => Promise<{ status: string; granted: boolean; canAskAgain?: boolean }>;
    requestBackgroundPermissionsAsync?: () => Promise<{ status: string; granted: boolean; canAskAgain?: boolean }>;
    getForegroundPermissionsAsync?: () => Promise<{ status: string; granted: boolean; canAskAgain?: boolean }>;
    getBackgroundPermissionsAsync?: () => Promise<{ status: string; granted: boolean; canAskAgain?: boolean }>;
};

type CalendarPermissionModule = {
    requestCalendarPermissionsAsync?: () => Promise<{ granted: boolean }>;
    getCalendarPermissionsAsync?: () => Promise<{ granted: boolean }>;
    requestRemindersPermissionsAsync?: () => Promise<{ granted: boolean }>;
    getRemindersPermissionsAsync?: () => Promise<{ granted: boolean }>;
};

function supportFor(sourceType: ContextSourceType): PlatformSupport {
    const platform: "ios" | "android" | "web" = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
    return SOURCE_DEFINITIONS[sourceType].platformSupport[platform];
}

function loadLocation(): LocationPermissionModule | null {
    try {
        // Optional dependency: installed only if/when location is enabled.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require("expo-location");
        return mod;
    } catch {
        return null;
    }
}

function loadCalendar(): CalendarPermissionModule | null {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require("expo-calendar");
        return mod;
    } catch {
        return null;
    }
}

function mapLocationStatus(status: string | undefined): PermissionState {
    switch (status) {
        case "granted": return "granted";
        case "denied": return "denied";
        case "undetermined": return "not_determined";
        case "restricted": return "restricted";
        default: return "unavailable";
    }
}

export const permissionManager = {
    platformSupport(sourceType: ContextSourceType): PlatformSupport {
        return supportFor(sourceType);
    },

    async getStatus(sourceType: ContextSourceType): Promise<PermissionManagerStatus> {
        const platformSupport = supportFor(sourceType);
        const base = { sourceType, platformSupport };
        if (platformSupport === "not_available") {
            return { ...base, state: "not_available", permissionState: "unavailable", canRequest: false, canRevoke: false };
        }
        if (platformSupport === "policy_restricted") {
            return { ...base, state: "not_available", permissionState: "restricted", canRequest: false, canRevoke: false };
        }

        switch (sourceType) {
            case "location": {
                const location = loadLocation();
                if (!location) {
                    return { ...base, state: "not_available", permissionState: "unavailable", canRequest: false, canRevoke: false };
                }
                try {
                    const foreground = await location.getForegroundPermissionsAsync?.();
                    const permissionState = mapLocationStatus(foreground?.status);
                    if (permissionState === "granted") {
                        return { ...base, state: "available", permissionState, canRequest: false, canRevoke: true };
                    }
                    if (permissionState === "denied" && foreground?.canAskAgain === false) {
                        return { ...base, state: "revoked", permissionState, canRequest: false, canRevoke: false };
                    }
                    return { ...base, state: "permission_required", permissionState, canRequest: foreground?.canAskAgain !== false, canRevoke: false };
                } catch {
                    return { ...base, state: "error", permissionState: "unavailable", canRequest: false, canRevoke: false };
                }
            }
            case "calendar": {
                const calendar = loadCalendar();
                if (!calendar) {
                    return { ...base, state: "not_available", permissionState: "unavailable", canRequest: false, canRevoke: false };
                }
                try {
                    const current = await calendar.getCalendarPermissionsAsync?.();
                    if (current?.granted) {
                        return { ...base, state: "available", permissionState: "granted", canRequest: false, canRevoke: true };
                    }
                    return { ...base, state: "permission_required", permissionState: "not_determined", canRequest: true, canRevoke: false };
                } catch {
                    return { ...base, state: "error", permissionState: "unavailable", canRequest: false, canRevoke: false };
                }
            }
            case "reminders":
            case "apple_reminders": {
                const calendar = loadCalendar();
                if (!calendar) {
                    return { ...base, state: "not_available", permissionState: "unavailable", canRequest: false, canRevoke: false };
                }
                try {
                    const current = await calendar.getRemindersPermissionsAsync?.();
                    if (current?.granted) {
                        return { ...base, state: "available", permissionState: "granted", canRequest: false, canRevoke: true };
                    }
                    return { ...base, state: "permission_required", permissionState: "not_determined", canRequest: true, canRevoke: false };
                } catch {
                    return { ...base, state: "error", permissionState: "unavailable", canRequest: false, canRevoke: false };
                }
            }
            case "apple_calendar": {
                // Same OS calendar store as `calendar`, exposed as its own row on iOS.
                return this.getStatus("calendar");
            }
            case "voice_session": {
                // Microphone permission is owned by the existing voice pipeline.
                return { ...base, state: "available", permissionState: "granted", canRequest: false, canRevoke: false };
            }
            case "google_calendar":
            case "google_tasks":
            case "notion":
            case "todoist":
            case "github":
            case "slack":
            case "email": {
                // OAuth sources: connection state is owned by the account-link
                // service (server-side tokens), not by an OS permission dialog.
                const linked = await isOAuthSourceLinked(sourceType).catch(() => false);
                return linked
                    ? { ...base, state: "available", permissionState: "granted", canRequest: false, canRevoke: true }
                    : { ...base, state: "not_connected", permissionState: "not_determined", canRequest: true, canRevoke: false };
            }
            default:
                return { ...base, state: "permission_required", permissionState: "not_determined", canRequest: true, canRevoke: false };
        }
    },

    async request(sourceType: ContextSourceType): Promise<PermissionManagerStatus> {
        const status = await this.getStatus(sourceType);
        if (!status.canRequest) return status;
        try {
            if (sourceType === "location") {
                const location = loadLocation();
                if (!location?.requestForegroundPermissionsAsync) return status;
                const result = await location.requestForegroundPermissionsAsync();
                return this.getStatus(sourceType);
            }
            if (sourceType === "calendar" || sourceType === "apple_calendar") {
                const calendar = loadCalendar();
                if (!calendar?.requestCalendarPermissionsAsync) return status;
                await calendar.requestCalendarPermissionsAsync();
                return this.getStatus(sourceType);
            }
            if (sourceType === "reminders" || sourceType === "apple_reminders") {
                const calendar = loadCalendar();
                if (!calendar?.requestRemindersPermissionsAsync) return status;
                await calendar.requestRemindersPermissionsAsync();
                return this.getStatus(sourceType);
            }
        } catch {
            return { ...status, state: "error", permissionState: "unavailable" };
        }
        return status;
    },

    /** System settings deep-link — the respectful path after a hard denial. */
    openSettings(): void {
        import("react-native").then(({ Linking }) => {
            void Linking.openSettings();
        });
    },

    /**
     * Revocation = disconnecting in Aks. OS permission is controlled by the
     * platform; Aks stops collecting and marks the source revoked.
     */
    canRevoke(sourceType: ContextSourceType): boolean {
        return sourceType !== "voice_session";
    },
};
