import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
    Platform: { OS: "android", select: vi.fn() },
    Linking: { openSettings: vi.fn() },
    NativeModules: {},
}));
vi.mock("@/lib/supabase", () => ({
    supabase: { rpc: vi.fn() },
    isSupabaseConfigured: true,
    supabaseUrl: "https://placeholder.supabase.co",
    assertSupabaseConfigured: () => undefined,
}));
vi.mock("@/repositories/data.repository", () => ({
    requireAuthenticatedUser: vi.fn().mockResolvedValue({ id: "user-a" }),
    throwDataError: vi.fn(),
}));

import { CONNECTABLE_SOURCES, OBSERVATION_COLLECTING_SOURCES, SOURCE_DEFINITIONS, SOURCE_GROUPS, type ContextSourceType, type ObservationDraft } from "./types";
import { OAUTH_SOURCE_NAMES } from "./oauth";
import { permissionManager } from "./permissions";
import { contextResolver } from "./contextResolver";

describe("source registry", () => {
    it("exposes only the final connectable set — removed sources are deleted, not unavailable", () => {
        for (const removed of ["calls", "messages", "contacts", "health", "photos", "notifications_source", "app_activity"] as const) {
            expect(CONNECTABLE_SOURCES as readonly string[]).not.toContain(removed);
            expect(Object.keys(SOURCE_DEFINITIONS)).not.toContain(removed);
        }
    });

    it("documents what is received and stored for every connectable source", () => {
        for (const sourceType of CONNECTABLE_SOURCES) {
            const definition = SOURCE_DEFINITIONS[sourceType];
            expect(definition.purpose.length).toBeGreaterThan(10);
            expect(definition.whatAksReceives.length).toBeGreaterThan(10);
            expect(definition.whatIsStored.length).toBeGreaterThan(10);
            expect(definition.howToStop.length).toBeGreaterThan(10);
        }
    });

    it("exposes per-platform support for every source (no fake availability)", () => {
        for (const definition of Object.values(SOURCE_DEFINITIONS)) {
            for (const platform of ["ios", "android", "web"] as const) {
                expect(["supported", "supported_with_conditions", "not_available", "policy_restricted"]).toContain(definition.platformSupport[platform]);
            }
        }
    });

    it("lists every connectable source exactly once across groups (no duplicate or empty rows)", () => {
        expect(new Set(CONNECTABLE_SOURCES).size).toBe(CONNECTABLE_SOURCES.length);

        const grouped = SOURCE_GROUPS.flatMap((group) => CONNECTABLE_SOURCES.filter((source) => SOURCE_DEFINITIONS[source].group === group.key));
        expect(grouped.sort()).toEqual([...CONNECTABLE_SOURCES].sort());
        for (const group of SOURCE_GROUPS) {
            expect(CONNECTABLE_SOURCES.some((source) => SOURCE_DEFINITIONS[source].group === group.key)).toBe(true);
        }
    });

    it("keeps the connectable list duplicate-free and registry-aligned", () => {
        expect(new Set(CONNECTABLE_SOURCES).size).toBe(CONNECTABLE_SOURCES.length);
        // Every connectable source is a real registry entry.
        for (const source of CONNECTABLE_SOURCES) {
            expect(SOURCE_DEFINITIONS[source]).toBeDefined();
        }
        // Final decision: exact connectable set (no photos/contacts/restricted).
        expect([...CONNECTABLE_SOURCES].sort()).toEqual([
            "location", "calendar", "google_calendar", "apple_calendar", "reminders", "google_tasks",
            "apple_reminders", "todoist", "notion", "github", "slack", "email", "screen_time",
        ].sort());
    });

    it("covers the final provider taxonomy and nothing removed", () => {
        expect(Object.keys(SOURCE_DEFINITIONS).sort()).toEqual([
            "google_calendar", "apple_calendar", "google_tasks", "apple_reminders",
            "notion", "todoist", "github", "slack", "email", "screen_time",
            "location", "calendar", "reminders", "voice_session",
        ].sort());
    });

    it("marks Apple-only providers unavailable on Android (no fake availability)", () => {
        expect(SOURCE_DEFINITIONS.apple_calendar.platformSupport.android).toBe("not_available");
        expect(SOURCE_DEFINITIONS.apple_reminders.platformSupport.android).toBe("not_available");
    });

    it("routes every OAuth provider through the account-link service", () => {
        for (const source of Object.keys(OAUTH_SOURCE_NAMES)) {
            expect(SOURCE_DEFINITIONS[source as ContextSourceType].connection).toBe("oauth");
        }
    });
});

describe("permission manager", () => {
    it("never allows requesting the builtin voice row from Connected Sources", async () => {
        const voice = await permissionManager.getStatus("voice_session");
        expect(voice.canRequest).toBe(false);
    });
});

describe("platform visibility (Apple on iOS, Android on Android)", () => {
    it("hides not_available sources instead of showing them as unavailable", async () => {
        const { contextService } = await import("./context.service");
        // Test env mocks Platform.OS = "android" with no native modules:
        // Apple-only + screen_time are not_available on Android and must be hidden.
        const statuses = await contextService.getStatuses();
        const types = statuses.map((status) => status.sourceType);
        expect(types).not.toContain("apple_calendar");
        expect(types).not.toContain("apple_reminders");
        expect(types).not.toContain("screen_time");
        // OAuth sources are supported everywhere — always shown.
        expect(types).toContain("google_calendar");
        expect(types).toContain("github");
        // No displayed row is unavailable.
        for (const status of statuses) {
            expect(status.runtime.platformSupport).not.toBe("not_available");
            expect(status.state).not.toBe("not_available");
            expect(status.state).not.toBe("error");
        }
        const grouped = await contextService.getGroupedStatuses();
        for (const group of grouped) {
            expect(group.sources.length).toBeGreaterThan(0);
        }
    });
});

describe("context selection & transparency", () => {
    it("returns no line when nothing is connected", () => {
        expect(contextResolver.transparencyLine(null)).toBeNull();
        expect(contextResolver.transparencyLine({ connectedSources: [], observations: [] })).toBeNull();
    });

    it("names only connected sources in the transparency line", () => {
        const line = contextResolver.transparencyLine({
            connectedSources: ["calendar", "location"],
            observations: [],
        });
        expect(line).toContain("calendar");
        expect(line).toContain("location");
        expect(line).toContain("connected");
    });
});

describe("observation drafts", () => {
    it("carry minimal structured values with a stable dedup identity", () => {
        const draft: ObservationDraft = {
            sourceType: "location",
            observationType: "place_context",
            sourceEventId: "home_area:1234",
            observedAt: "2026-09-20T18:30:00Z",
            value: { context: "home_area" },
        };
        expect(Object.keys(draft.value)).toEqual(["context"]);
        expect(draft.sourceEventId).not.toMatch(/latitude|longitude|-?7[0-9]\.\d+/);
    });
});
