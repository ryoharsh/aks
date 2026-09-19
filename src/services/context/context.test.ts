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
    it("marks restricted sources honestly and keeps them unconnectable", () => {
        expect(SOURCE_DEFINITIONS.calls.platformSupport.ios).toBe("not_available");
        expect(SOURCE_DEFINITIONS.calls.platformSupport.android).toBe("policy_restricted");
        expect(SOURCE_DEFINITIONS.messages.platformSupport.android).toBe("policy_restricted");
        expect(CONNECTABLE_SOURCES).not.toContain("calls");
        expect(CONNECTABLE_SOURCES).not.toContain("messages");
        expect(CONNECTABLE_SOURCES).not.toContain("contacts");
        expect(CONNECTABLE_SOURCES).not.toContain("health");
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

    it("lists every source exactly once across groups (no duplicate rows)", () => {
        const allSources = Object.keys(SOURCE_DEFINITIONS) as ContextSourceType[];
        expect(new Set(allSources).size).toBe(allSources.length);

        const grouped = SOURCE_GROUPS.flatMap((group) => allSources.filter((source) => SOURCE_DEFINITIONS[source].group === group.key));
        expect(grouped.sort()).toEqual([...allSources].sort());
    });

    it("keeps the connectable list duplicate-free and registry-aligned", () => {
        expect(new Set(CONNECTABLE_SOURCES).size).toBe(CONNECTABLE_SOURCES.length);
        // Every connectable source is a real registry entry.
        for (const source of CONNECTABLE_SOURCES) {
            expect(SOURCE_DEFINITIONS[source]).toBeDefined();
        }
    });

    it("covers the full provider taxonomy", () => {
        const all = Object.keys(SOURCE_DEFINITIONS) as ContextSourceType[];
        for (const expected of [
            "google_calendar", "apple_calendar", "google_tasks", "apple_reminders",
            "notion", "todoist", "github", "slack", "email", "screen_time",
            "location", "notifications_source", "health", "voice_session", "photos",
            "contacts", "calls", "messages",
        ] as const) {
            expect(all).toContain(expected);
        }
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
    it("reports restricted sources as not available with canRequest=false", async () => {
        const calls = await permissionManager.getStatus("calls");
        expect(calls.state).toBe("not_available");
        expect(calls.canRequest).toBe(false);
    });

    it("never allows requesting restricted or unavailable permissions", async () => {
        for (const sourceType of ["calls", "messages", "notifications_source"] as const) {
            expect((await permissionManager.getStatus(sourceType)).canRequest).toBe(false);
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
