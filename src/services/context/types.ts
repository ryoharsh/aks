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
    | "app_activity"
    | "contacts"
    | "calls"
    | "messages"
    | "notifications_source"
    | "photos"
    | "health"
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
    group: "productivity" | "work" | "device" | "health" | "personal" | "restricted" | "delivery";
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
        name: "Location",
        connection: "os",
        group: "device",
        purpose: "Let Aks understand where your day happens. This can help distinguish a difficult day from a day disrupted by travel or unexpected changes.",
        whatAksReceives: "Coarse place context (home area, work area, travel, unfamiliar place) and movement windows — never continuous tracking.",
        whatIsStored: "Observation windows like 'travel, 45 minutes around 6:30 PM'. Precise coordinates are not stored.",
        howToStop: "Disconnect Location any time. Future collection stops immediately; already-stored observations can be deleted separately.",
        platformSupport: { ios: "supported", android: "supported", web: "not_available" },
        batteryNote: "Uses occasional location checks while connected. Enabling may increase battery usage slightly.",
    },
    calendar: {
        sourceType: "calendar",
        name: "Calendar",
        connection: "os",
        group: "productivity",
        purpose: "Planned events help Aks understand the difference between a plan that changed and motivation that dipped.",
        whatAksReceives: "Event times and a broad category. Titles only when they define the plan; never attendee lists, notes, or meeting links.",
        whatIsStored: "Minimal event records: time, duration, category, confirmed/cancelled.",
        howToStop: "Disconnect Calendar any time. Future collection stops immediately.",
        platformSupport: { ios: "supported", android: "supported", web: "not_available" },
    },
    reminders: {
        sourceType: "reminders",
        name: "Tasks & reminders",
        connection: "os",
        group: "productivity",
        purpose: "Planned actions vs. what actually happened — without Aks ever claiming you 'skipped' something.",
        whatAksReceives: "Due times and completion state of reminders you choose to sync.",
        whatIsStored: "Due time and completed/not-recorded status.",
        howToStop: "Disconnect Tasks & reminders any time.",
        platformSupport: { ios: "supported", android: "supported_with_conditions", web: "not_available" },
    },
    screen_time: {
        sourceType: "screen_time",
        name: "Screen time",
        connection: "os",
        group: "device",
        purpose: "Aggregated device-usage context may explain focus changes — it is never treated as proof of distraction.",
        whatAksReceives: "Aggregated usage durations by broad category per time window.",
        whatIsStored: "Aggregated windows like 'social apps, 60 minutes, 9–10 PM'. No per-tap data.",
        howToStop: "Disconnect Screen time any time.",
        platformSupport: { ios: "supported_with_conditions", android: "not_available", web: "not_available" },
    },
    contacts: {
        sourceType: "contacts",
        name: "Contacts",
        connection: "os",
        group: "personal",
        purpose: "Only used if a future Aks feature explicitly asks you to pick a contact.",
        whatAksReceives: "Nothing until a feature needs it, and then only what you select.",
        whatIsStored: "Minimal identifiers for selected contacts only. No address book import, no social graph.",
        howToStop: "Never connected by default.",
        platformSupport: { ios: "supported_with_conditions", android: "supported_with_conditions", web: "not_available" },
    },
    calls: {
        sourceType: "calls",
        name: "Calls",
        connection: "os",
        group: "restricted",
        purpose: "Call metadata could add context, but platform policies restrict this heavily for apps like Aks.",
        whatAksReceives: "Nothing in the current build.",
        whatIsStored: "Nothing. Aks does not read call logs.",
        howToStop: "Nothing to stop — the source stays unavailable.",
        platformSupport: { ios: "not_available", android: "policy_restricted", web: "not_available" },
        requiresSpecialApproval: true,
    },
    messages: {
        sourceType: "messages",
        name: "Messages",
        connection: "os",
        group: "restricted",
        purpose: "Message content stays yours. Aks does not read SMS or messaging apps.",
        whatAksReceives: "Nothing in the current build.",
        whatIsStored: "Nothing.",
        howToStop: "Nothing to stop — the source stays unavailable.",
        platformSupport: { ios: "not_available", android: "policy_restricted", web: "not_available" },
        requiresSpecialApproval: true,
    },
    notifications_source: {
        sourceType: "notifications_source",
        name: "Notifications",
        connection: "os",
        group: "device",
        purpose: "Reading other apps' notifications is restricted and not needed for Aks today. Aks sending you notifications (delivery) is separate and does not read anything.",
        whatAksReceives: "Nothing in the current build.",
        whatIsStored: "Nothing. Delivery of Aks notifications is handled by OneSignal under a separate row.",
        howToStop: "Nothing to stop — the source stays unavailable.",
        platformSupport: { ios: "not_available", android: "policy_restricted", web: "not_available" },
        requiresSpecialApproval: true,
    },
    photos: {
        sourceType: "photos",
        name: "Photos",
        connection: "os",
        group: "personal",
        purpose: "Aks never scans your library. If a feature ever needs a photo, you pick it.",
        whatAksReceives: "Only photos you explicitly choose (via the system picker).",
        whatIsStored: "Only the chosen item.",
        howToStop: "Nothing to stop — no library access is requested.",
        platformSupport: { ios: "supported_with_conditions", android: "supported_with_conditions", web: "supported_with_conditions" },
    },
    health: {
        sourceType: "health",
        name: "Health & fitness",
        connection: "os",
        group: "health",
        purpose: "Health data is highly sensitive; Aks has no health feature today, so no health permission is requested.",
        whatAksReceives: "Nothing in the current build.",
        whatIsStored: "Nothing.",
        howToStop: "Nothing to stop — no health permission is requested.",
        platformSupport: { ios: "supported_with_conditions", android: "supported_with_conditions", web: "not_available" },
        requiresSpecialApproval: true,
    },
    app_activity: {
        sourceType: "app_activity",
        name: "App activity",
        connection: "os",
        group: "device",
        purpose: "Observation of your own in-app activity is not needed beyond what you do in Aks itself.",
        whatAksReceives: "Nothing beyond normal Aks usage.",
        whatIsStored: "Nothing beyond normal Aks usage.",
        howToStop: "Nothing to stop.",
        platformSupport: { ios: "not_available", android: "not_available", web: "not_available" },
    },
    google_calendar: {
        sourceType: "google_calendar",
        name: "Google Calendar",
        connection: "oauth",
        group: "productivity",
        purpose: "Your Google events give Aks the same planning context as your device calendar, for accounts you explicitly connect.",
        whatAksReceives: "Event times and a broad category from the calendars you select. Never attendee lists, notes, or meeting links.",
        whatIsStored: "Minimal event records: time, duration, category, confirmed/cancelled.",
        howToStop: "Disconnect Google Calendar any time — and revoke access in your Google account settings.",
        platformSupport: { ios: "supported", android: "supported", web: "supported" },
    },
    apple_calendar: {
        sourceType: "apple_calendar",
        name: "Apple Calendar",
        connection: "os",
        group: "productivity",
        purpose: "On iPhone and iPad, the same device calendar context through Apple's calendar store.",
        whatAksReceives: "Event times and a broad category. Never attendee lists, notes, or meeting links.",
        whatIsStored: "Minimal event records: time, duration, category, confirmed/cancelled.",
        howToStop: "Disconnect Apple Calendar any time.",
        platformSupport: { ios: "supported", android: "not_available", web: "not_available" },
    },
    google_tasks: {
        sourceType: "google_tasks",
        name: "Google Tasks",
        connection: "oauth",
        group: "productivity",
        purpose: "Planned tasks from a Google account you connect, so Aks sees what you intended — never concluding you failed.",
        whatAksReceives: "Task due times and completion state.",
        whatIsStored: "Due time and completed/not-recorded status.",
        howToStop: "Disconnect Google Tasks any time — and revoke access in your Google account settings.",
        platformSupport: { ios: "supported", android: "supported", web: "supported" },
    },
    apple_reminders: {
        sourceType: "apple_reminders",
        name: "Apple Reminders",
        connection: "os",
        group: "productivity",
        purpose: "On iPhone and iPad, planned actions from Apple Reminders feed the same planned-vs-happened context.",
        whatAksReceives: "Due times and completion state of reminders.",
        whatIsStored: "Due time and completed/not-recorded status.",
        howToStop: "Disconnect Apple Reminders any time.",
        platformSupport: { ios: "supported", android: "not_available", web: "not_available" },
    },
    notion: {
        sourceType: "notion",
        name: "Notion",
        connection: "oauth",
        group: "work",
        purpose: "Pages and databases you explicitly share with the Aks integration, so work context can inform conversations.",
        whatAksReceives: "Titles, times, and a broad category for content you shared with the Aks Notion integration. Never page bodies.",
        whatIsStored: "Minimal item records: title-category, time, status.",
        howToStop: "Disconnect Notion any time — and remove the Aks integration from your Notion workspace.",
        platformSupport: { ios: "supported", android: "supported", web: "supported" },
    },
    todoist: {
        sourceType: "todoist",
        name: "Todoist",
        connection: "oauth",
        group: "productivity",
        purpose: "A connected task provider (Todoist or similar) so plans outside Aks count too.",
        whatAksReceives: "Task due times and completion state.",
        whatIsStored: "Due time and completed/not-recorded status.",
        howToStop: "Disconnect Todoist any time — and revoke access in the provider's account settings.",
        platformSupport: { ios: "supported", android: "supported", web: "supported" },
    },
    github: {
        sourceType: "github",
        name: "GitHub",
        connection: "oauth",
        group: "work",
        purpose: "Your own commit and PR activity as objective work context — never other people's data.",
        whatAksReceives: "Your commit and pull-request activity counts and times from repos you select.",
        whatIsStored: "Aggregated activity windows like '2 commits, 10–11 PM'. No code content.",
        howToStop: "Disconnect GitHub any time — and revoke the Aks OAuth app in your GitHub settings.",
        platformSupport: { ios: "supported", android: "supported", web: "supported" },
    },
    slack: {
        sourceType: "slack",
        name: "Slack",
        connection: "oauth",
        group: "work",
        purpose: "Focus-block and availability signals from workspaces you explicitly connect.",
        whatAksReceives: "Your own activity windows and Do-Not-Disturb state. Never message content.",
        whatIsStored: "Aggregated activity windows. No messages, no channels, no colleagues' data.",
        howToStop: "Disconnect Slack any time — and remove the Aks app from your workspace.",
        platformSupport: { ios: "supported", android: "supported", web: "supported" },
    },
    email: {
        sourceType: "email",
        name: "Email",
        connection: "oauth",
        group: "work",
        purpose: "Lightweight email-load context (counts only) from providers you connect — Gmail or others.",
        whatAksReceives: "Counts and timing of received email. Never subject lines, bodies, or senders.",
        whatIsStored: "Aggregated counts per window. No content, no addresses.",
        howToStop: "Disconnect Email any time — and revoke access in the provider's security settings.",
        platformSupport: { ios: "supported", android: "supported", web: "supported" },
    },
    voice_session: {
        sourceType: "voice_session",
        name: "Microphone",
        connection: "builtin",
        group: "personal",
        purpose: "Voice conversations are an explicit action you start. The microphone is used only during an active voice session.",
        whatAksReceives: "Audio only while a voice conversation is running.",
        whatIsStored: "Transcripts you keep; audio is not stored.",
        howToStop: "End the voice session — the microphone turns off. Aks never listens in the background.",
        platformSupport: { ios: "supported", android: "supported", web: "supported" },
    },
};

/** Aks is useful with zero connected sources — nothing here is required. */
export const CONNECTABLE_SOURCES: ContextSourceType[] = [
    "location", "calendar", "google_calendar", "apple_calendar", "reminders", "google_tasks",
    "apple_reminders", "todoist", "notion", "github", "slack", "email", "screen_time", "photos",
];

/** The fixed section order shown on the Connected Sources screen. */
export const SOURCE_GROUPS: Array<{ key: SourceDefinition["group"]; label: string }> = [
    { key: "productivity", label: "PRODUCTIVITY" },
    { key: "work", label: "WORK" },
    { key: "device", label: "DEVICE / BEHAVIOR" },
    { key: "health", label: "HEALTH" },
    { key: "personal", label: "PERSONAL" },
    { key: "restricted", label: "RESTRICTED" },
];

/** Sources that collect observations; every connectable source does. */
export const OBSERVATION_COLLECTING_SOURCES: ContextSourceType[] = [...CONNECTABLE_SOURCES];
