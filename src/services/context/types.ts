import { copy } from "@/constants/copy";

export type ContextSourceType =
    | "location"
    | "calendar"
    | "google_calendar"
    | "apple_calendar"
    | "reminders"
    | "google_tasks"
    | "apple_reminders"
    | "notion"
    | "todoist"
    | "github"
    | "slack"
    | "email"
    | "screen_time"
    | "voice_session";

export type SourceStatus = "not_connected" | "connected" | "revoked" | "error";
export type PermissionState = "not_determined" | "granted" | "denied" | "restricted" | "unavailable";
export type PlatformSupport = "supported" | "supported_with_conditions" | "not_available" | "policy_restricted";

/** Effective runtime state — distinguishes why a source is or isn't usable. */
export type SourceState =
    | "available"
    | "not_available"
    | "not_connected"
    | "permission_required"
    | "connected"
    | "temporarily_unavailable"
    | "revoked"
    | "error";

export type SourceDefinition = {
    sourceType: ContextSourceType;
    name: string;
    purpose: string;
    whatAksReceives: string;
    whatIsStored: string;
    howToStop: string;
    platformSupport: Record<"ios" | "android" | "web", PlatformSupport>;
    requiresSpecialApproval?: boolean;
    batteryNote?: string;
    /** How the source connects: local OS permission or an external account. */
    connection: "os" | "oauth" | "builtin";
    /** Registry groups shown on the Connected Sources screen. */
    group: "productivity" | "work" | "device" | "personal";
};

export type Observation<T extends Record<string, unknown> = Record<string, unknown>> = {
    id: string;
    userId: string;
    sourceType: ContextSourceType;
    observationType: string;
    sourceEventId: string;
    observedAt: string;
    value: T;
    confidence?: number | null;
    metadata?: Record<string, unknown>;
};

export type ObservationDraft<T extends Record<string, unknown> = Record<string, unknown>> = {
    sourceType: ContextSourceType;
    observationType: string;
    sourceEventId: string;
    observedAt: string;
    value: T;
    confidence?: number | null;
    metadata?: Record<string, unknown>;
};

export type SourceRecord = {
    sourceType: ContextSourceType;
    status: SourceStatus;
    permissionState: PermissionState;
    platformSupport: PlatformSupport;
    mode: string | null;
    lastSyncedAt: string | null;
    settings: Record<string, unknown>;
};

export const SOURCE_DEFINITIONS: Record<ContextSourceType, SourceDefinition> = {
    location: {
        sourceType: "location",
        name: copy.sources.location.name,
        connection: "os",
        group: "device",
        purpose: copy.sources.location.purpose,
        whatAksReceives: copy.sources.location.receives,
        whatIsStored: copy.sources.location.stored,
        howToStop: copy.sources.location.stop,
        platformSupport: { ios: "supported", android: "supported", web: "not_available" },
        batteryNote: copy.sources.location.batteryNote,
    },
    calendar: {
        sourceType: "calendar",
        name: copy.sources.calendar.name,
        connection: "os",
        group: "productivity",
        purpose: copy.sources.calendar.purpose,
        whatAksReceives: copy.sources.calendar.receives,
        whatIsStored: copy.sources.calendar.stored,
        howToStop: copy.sources.calendar.stop,
        platformSupport: { ios: "supported", android: "supported", web: "not_available" },
    },
    reminders: {
        sourceType: "reminders",
        name: copy.sources.reminders.name,
        connection: "os",
        group: "productivity",
        purpose: copy.sources.reminders.purpose,
        whatAksReceives: copy.sources.reminders.receives,
        whatIsStored: copy.sources.reminders.stored,
        howToStop: copy.sources.reminders.stop,
        platformSupport: { ios: "supported", android: "supported_with_conditions", web: "not_available" },
    },
    screen_time: {
        sourceType: "screen_time",
        name: copy.sources.screenTime.name,
        connection: "os",
        group: "device",
        purpose: copy.sources.screenTime.purpose,
        whatAksReceives: copy.sources.screenTime.receives,
        whatIsStored: copy.sources.screenTime.stored,
        howToStop: copy.sources.screenTime.stop,
        platformSupport: { ios: "supported_with_conditions", android: "not_available", web: "not_available" },
    },
    google_calendar: {
        sourceType: "google_calendar",
        name: copy.sources.googleCalendar.name,
        connection: "oauth",
        group: "productivity",
        purpose: copy.sources.googleCalendar.purpose,
        whatAksReceives: copy.sources.googleCalendar.receives,
        whatIsStored: copy.sources.googleCalendar.stored,
        howToStop: copy.sources.googleCalendar.stop,
        platformSupport: { ios: "supported", android: "supported", web: "supported" },
    },
    apple_calendar: {
        sourceType: "apple_calendar",
        name: copy.sources.appleCalendar.name,
        connection: "os",
        group: "productivity",
        purpose: copy.sources.appleCalendar.purpose,
        whatAksReceives: copy.sources.appleCalendar.receives,
        whatIsStored: copy.sources.appleCalendar.stored,
        howToStop: copy.sources.appleCalendar.stop,
        platformSupport: { ios: "supported", android: "not_available", web: "not_available" },
    },
    google_tasks: {
        sourceType: "google_tasks",
        name: copy.sources.googleTasks.name,
        connection: "oauth",
        group: "productivity",
        purpose: copy.sources.googleTasks.purpose,
        whatAksReceives: copy.sources.googleTasks.receives,
        whatIsStored: copy.sources.googleTasks.stored,
        howToStop: copy.sources.googleTasks.stop,
        platformSupport: { ios: "supported", android: "supported", web: "supported" },
    },
    apple_reminders: {
        sourceType: "apple_reminders",
        name: copy.sources.appleReminders.name,
        connection: "os",
        group: "productivity",
        purpose: copy.sources.appleReminders.purpose,
        whatAksReceives: copy.sources.appleReminders.receives,
        whatIsStored: copy.sources.appleReminders.stored,
        howToStop: copy.sources.appleReminders.stop,
        platformSupport: { ios: "supported", android: "not_available", web: "not_available" },
    },
    notion: {
        sourceType: "notion",
        name: copy.sources.notion.name,
        connection: "oauth",
        group: "work",
        purpose: copy.sources.notion.purpose,
        whatAksReceives: copy.sources.notion.receives,
        whatIsStored: copy.sources.notion.stored,
        howToStop: copy.sources.notion.stop,
        platformSupport: { ios: "supported", android: "supported", web: "supported" },
    },
    todoist: {
        sourceType: "todoist",
        name: copy.sources.todoist.name,
        connection: "oauth",
        group: "productivity",
        purpose: copy.sources.todoist.purpose,
        whatAksReceives: copy.sources.todoist.receives,
        whatIsStored: copy.sources.todoist.stored,
        howToStop: copy.sources.todoist.stop,
        platformSupport: { ios: "supported", android: "supported", web: "supported" },
    },
    github: {
        sourceType: "github",
        name: copy.sources.github.name,
        connection: "oauth",
        group: "work",
        purpose: copy.sources.github.purpose,
        whatAksReceives: copy.sources.github.receives,
        whatIsStored: copy.sources.github.stored,
        howToStop: copy.sources.github.stop,
        platformSupport: { ios: "supported", android: "supported", web: "supported" },
    },
    slack: {
        sourceType: "slack",
        name: copy.sources.slack.name,
        connection: "oauth",
        group: "work",
        purpose: copy.sources.slack.purpose,
        whatAksReceives: copy.sources.slack.receives,
        whatIsStored: copy.sources.slack.stored,
        howToStop: copy.sources.slack.stop,
        platformSupport: { ios: "supported", android: "supported", web: "supported" },
    },
    email: {
        sourceType: "email",
        name: copy.sources.email.name,
        connection: "oauth",
        group: "work",
        purpose: copy.sources.email.purpose,
        whatAksReceives: copy.sources.email.receives,
        whatIsStored: copy.sources.email.stored,
        howToStop: copy.sources.email.stop,
        platformSupport: { ios: "supported", android: "supported", web: "supported" },
    },
    voice_session: {
        sourceType: "voice_session",
        name: copy.sources.voiceSession.name,
        connection: "builtin",
        group: "personal",
        purpose: copy.sources.voiceSession.purpose,
        whatAksReceives: copy.sources.voiceSession.receives,
        whatIsStored: copy.sources.voiceSession.stored,
        howToStop: copy.sources.voiceSession.stop,
        platformSupport: { ios: "supported", android: "supported", web: "supported" },
    },
};

/** Aks is useful with zero connected sources — nothing here is required. */
/** Final product decision: only these 13 are connectable. Removed sources are deleted, not shown as unavailable. */
export const CONNECTABLE_SOURCES: ContextSourceType[] = [
    "location", "calendar", "google_calendar", "apple_calendar", "reminders", "google_tasks",
    "apple_reminders", "todoist", "notion", "github", "slack", "email", "screen_time",
];

/** The fixed section order shown on the Connected Sources screen. */
export const SOURCE_GROUPS: Array<{ key: SourceDefinition["group"]; label: string }> = [
    { key: "productivity", label: copy.connectedSources.groups.productivity },
    { key: "work", label: copy.connectedSources.groups.work },
    { key: "device", label: copy.connectedSources.groups.device },
];

/** Sources that collect observations; every connectable source does. */
export const OBSERVATION_COLLECTING_SOURCES: ContextSourceType[] = [...CONNECTABLE_SOURCES];
