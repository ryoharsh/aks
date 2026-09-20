// Provider data fetchers for OAuth sources. Runs only in Edge Functions with
// server-held tokens — the mobile app never sees provider credentials.
// Every fetcher returns normalized observation drafts with stable event ids
// and MINIMAL fields (metadata and windows only, never content bodies).

export type ProviderObservationDraft = {
    observationType: string;
    sourceEventId: string;
    observedAt: string;
    value: Record<string, unknown>;
    confidence?: number;
};

export type ProviderFetchContext = {
    accessToken: string;
    /** Exclusive lower bound for incremental syncs (ISO string). */
    sinceIso: string;
    /** Upper bound (ISO string) — usually "now + small lookahead". */
    untilIso: string;
};

const FETCH_TIMEOUT_MS = 12_000;

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        if (!response.ok) {
            // 401/403 are token/permission problems (retryable via re-consent);
            // 429/5xx are transient. The caller maps them to sync states.
            const error = new Error(`provider_http_${response.status}`);
            (error as Error & { status?: number }).status = response.status;
            throw error;
        }
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}

function iso(value: unknown): string | null {
    const parsed = typeof value === "string" || typeof value === "number" ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null;
}

function eventCategory(title: string | null): string {
    if (!title) return "general";
    const lower = title.toLowerCase();
    if (/(study|work|focus|deep)/.test(lower)) return "focus";
    if (/(gym|workout|training|run)/.test(lower)) return "fitness";
    if (/(meet|standup|sync|1:1|review)/.test(lower)) return "meeting";
    if (/(travel|flight|trip|commute)/.test(lower)) return "travel";
    return "general";
}

// --- Google Calendar ---------------------------------------------------------
// Minimal fields: times + category. Never attendees/notes/hangout links.
type GCalEvent = { id: string; status?: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } };

export async function fetchGoogleCalendarEvents(context: ProviderFetchContext): Promise<ProviderObservationDraft[]> {
    const params = new URLSearchParams({
        timeMin: context.sinceIso,
        timeMax: context.untilIso,
        singleEvents: "true",
        maxResults: "50",
        orderBy: "startTime",
    });
    const data = await fetchJson(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
        headers: { Authorization: `Bearer ${context.accessToken}` },
    }) as { items?: GCalEvent[] };

    return (data.items ?? []).flatMap((event) => {
        const startIso = iso(event.start?.dateTime ?? event.start?.date);
        const endIso = iso(event.end?.dateTime ?? event.end?.date);
        if (!startIso || !endIso) return [];
        const durationMinutes = Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000));
        return [{
            observationType: "planned_event",
            sourceEventId: `gcal:${event.id}`,
            observedAt: startIso,
            value: {
                eventCategory: eventCategory(event.summary ?? null),
                scheduledStart: startIso,
                scheduledEnd: endIso,
                scheduledDurationMinutes: durationMinutes,
                status: event.status === "cancelled" ? "cancelled" : "confirmed",
            },
        }];
    });
}

// --- Google Tasks ------------------------------------------------------------
// Due times + completion only. Never notes/links.
type GTasksList = { items?: Array<{ id: string; due?: string; completed?: string; deleted?: boolean; title?: string }> };

export async function fetchGoogleTasks(context: ProviderFetchContext): Promise<ProviderObservationDraft[]> {
    const data = await fetchJson(
        `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=true&showHidden=false&maxResults=100`,
        { headers: { Authorization: `Bearer ${context.accessToken}` } },
    ) as GTasksList;

    return (data.items ?? []).flatMap((task) => {
        if (task.deleted) return [];
        const dueIso = iso(task.due);
        if (!dueIso) return [];
        const dueMs = Date.parse(dueIso);
        if (dueMs < Date.parse(context.sinceIso) - 7 * 86400000 || dueMs > Date.parse(context.untilIso)) return [];
        return [{
            observationType: "planned_action",
            sourceEventId: `gtask:${task.id}`,
            observedAt: dueIso,
            value: { dueAt: dueIso, completed: Boolean(task.completed) },
        }];
    });
}

// --- Todoist -----------------------------------------------------------------
type TodoistTask = { id: string; due?: { date?: string }; isCompleted: boolean; completedAt?: string | null };

export async function fetchTodoistTasks(context: ProviderFetchContext): Promise<ProviderObservationDraft[]> {
    const data = await fetchJson("https://api.todoist.com/rest/v2/tasks", {
        headers: { Authorization: `Bearer ${context.accessToken}` },
    }) as TodoistTask[];
    const completed = await fetchJson(
        `https://api.todoist.com/sync/v9/completed?since=${encodeURIComponent(context.sinceIso.slice(0, 19))}`,
        { headers: { Authorization: `Bearer ${context.accessToken}` } },
    ).catch(() => []) as Array<{ task_id?: string; completed_at?: string }>;

    const completedIds = new Set(completed.map((item) => item.task_id).filter(Boolean) as string[]);
    const seen = new Set<string>();
    const drafts: ProviderObservationDraft[] = [];
    for (const task of data) {
        if (seen.has(task.id)) continue;
        seen.add(task.id);
        const dueIso = iso(task.due?.date);
        if (!dueIso) continue;
        const isCompleted = task.isCompleted || completedIds.has(task.id);
        drafts.push({
            observationType: "planned_action",
            sourceEventId: `todoist:${task.id}`,
            observedAt: dueIso,
            value: { dueAt: dueIso, completed: isCompleted },
        });
    }
    return drafts.slice(0, 100);
}

// --- GitHub ------------------------------------------------------------------
// Own commit/PR activity as aggregated windows + per-event ids. No code content.
type GitHubEvent = { id: string; type?: string; created_at?: string; payload?: { commits?: unknown[]; pull_request?: { id?: number } } };

export async function fetchGitHubActivity(context: ProviderFetchContext): Promise<ProviderObservationDraft[]> {
    const events = await fetchJson("https://api.github.com/users/me/events?per_page=60", {
        headers: { Authorization: `Bearer ${context.accessToken}`, Accept: "application/vnd.github+json" },
    }).catch(async (error: unknown) => {
        // /users/me requires newer scopes; fall back to authenticated user events.
        if ((error as Error & { status?: number }).status === 404) {
            return fetchJson("https://api.github.com/user/events?per_page=60", {
                headers: { Authorization: `Bearer ${context.accessToken}`, Accept: "application/vnd.github+json" },
            });
        }
        throw error;
    }) as GitHubEvent[];

    const byHour = new Map<string, { commits: number; pullRequests: number }>();
    for (const event of events) {
        const when = iso(event.created_at);
        if (!when || Date.parse(when) < Date.parse(context.sinceIso)) continue;
        const bucket = when.slice(0, 13); // hour window
        const totals = byHour.get(bucket) ?? { commits: 0, pullRequests: 0 };
        if (event.type === "PushEvent") totals.commits += event.payload?.commits?.length ?? 0;
        if (event.type === "PullRequestEvent") totals.pullRequests += 1;
        byHour.set(bucket, totals);
    }
    return [...byHour.entries()].map(([bucket, totals]) => ({
        observationType: "commit_activity",
        sourceEventId: `github:${bucket}`,
        observedAt: `${bucket}:00:00Z`,
        value: { commits: totals.commits, pullRequests: totals.pullRequests },
    }));
}

// --- Slack -------------------------------------------------------------------
// Own activity windows only, aggregated across the workspace's public channels
// the integration can read. Never message content, private channels, or DMs.
type SlackConversation = { ok: boolean; channels?: Array<{ id: string }>; error?: string };
type SlackHistory = { ok: boolean; messages?: Array<{ ts?: string; user?: string }>; error?: string };

export async function fetchSlackActivity(context: ProviderFetchContext): Promise<ProviderObservationDraft[]> {
    const list = await fetchJson(
        `https://slack.com/api/conversations.list?exclude_archived=true&limit=50&types=public_channel`,
        { headers: { Authorization: `Bearer ${context.accessToken}` } },
    ) as SlackConversation;
    if (!list.ok) {
        const error = new Error(`slack_${list.error ?? "error"}`);
        (error as Error & { status?: number }).status = 403;
        throw error;
    }
    const oldest = Math.floor(Date.parse(context.sinceIso) / 1000);
    const latest = Math.floor(Date.parse(context.untilIso) / 1000);
    const byHour = new Map<string, number>();
    for (const channel of (list.channels ?? []).slice(0, 10)) {
        const history = await fetchJson(
            `https://slack.com/api/conversations.history?channel=${channel.id}&oldest=${oldest}&latest=${latest}&limit=200`,
            { headers: { Authorization: `Bearer ${context.accessToken}` } },
        ) as SlackHistory;
        if (!history.ok) continue;
        for (const message of history.messages ?? []) {
            if (!message.ts) continue;
            const when = iso(Number(message.ts) * 1000);
            if (!when) continue;
            const bucket = when.slice(0, 13);
            byHour.set(bucket, (byHour.get(bucket) ?? 0) + 1);
        }
    }
    return [...byHour.entries()].map(([bucket, count]) => ({
        observationType: "communication_window",
        sourceEventId: `slack:${bucket}`,
        observedAt: `${bucket}:00:00Z`,
        value: { messages: count },
    }));
}

// --- Notion ------------------------------------------------------------------
// Pages shared with the Aks integration: title-free update windows only.
type NotionPage = { id: string; last_edited_time?: string; created_time?: string };

export async function fetchNotionActivity(context: ProviderFetchContext): Promise<ProviderObservationDraft[]> {
    const data = await fetchJson("https://api.notion.com/v1/search?page_size=50", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${context.accessToken}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ page_size: 50 }),
    }) as { results?: NotionPage[] };

    return (data.results ?? []).flatMap((page) => {
        const edited = iso(page.last_edited_time ?? page.created_time);
        if (!edited || Date.parse(edited) < Date.parse(context.sinceIso)) return [];
        return [{
            observationType: "page_update",
            sourceEventId: `notion:${page.id}:${edited.slice(0, 16)}`,
            observedAt: edited,
            value: { updatedAt: edited },
        }];
    }).slice(0, 50);
}

// --- Email (Gmail metadata-only) --------------------------------------------
// Counts and timing per hour. Never subjects, bodies, or sender addresses.
type GmailList = { messages?: Array<{ id: string; threadId?: string }> };

export async function fetchEmailActivity(context: ProviderFetchContext): Promise<ProviderObservationDraft[]> {
    const list = await fetchJson(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after:${Math.floor(Date.parse(context.sinceIso) / 1000)}&maxResults=100`,
        { headers: { Authorization: `Bearer ${context.accessToken}` } },
    ) as GmailList;

    const byHour = new Map<string, number>();
    for (const message of (list.messages ?? []).slice(0, 40)) {
        const meta = await fetchJson(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=&fields=id,internalDate`,
            { headers: { Authorization: `Bearer ${context.accessToken}` } },
        ) as { internalDate?: string };
        const when = iso(meta.internalDate ? Number(meta.internalDate) : null);
        if (!when) continue;
        const bucket = when.slice(0, 13);
        byHour.set(bucket, (byHour.get(bucket) ?? 0) + 1);
    }
    return [...byHour.entries()].map(([bucket, count]) => ({
        observationType: "communication_window",
        sourceEventId: `email:${bucket}`,
        observedAt: `${bucket}:00:00Z`,
        value: { messages: count },
    }));
}

// --- Dispatch table -----------------------------------------------------------

export type ProviderFetcher = (context: ProviderFetchContext) => Promise<ProviderObservationDraft[]>;

export const PROVIDER_FETCHERS: Record<string, ProviderFetcher> = {
    google_calendar: fetchGoogleCalendarEvents,
    google_tasks: fetchGoogleTasks,
    todoist: fetchTodoistTasks,
    github: fetchGitHubActivity,
    notion: fetchNotionActivity,
    email: fetchEmailActivity,
    slack: fetchSlackActivity,
};
