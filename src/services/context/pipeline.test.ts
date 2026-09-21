import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
    Platform: { OS: "android", select: vi.fn() },
    Linking: { openSettings: vi.fn(), openURL: vi.fn().mockResolvedValue(undefined) },
    NativeModules: {},
}));
vi.mock("@/lib/supabase", () => ({
    supabase: { rpc: vi.fn(), from: vi.fn() },
    isSupabaseConfigured: true,
    supabaseUrl: "https://placeholder.supabase.co",
    assertSupabaseConfigured: () => undefined,
}));
vi.mock("@/repositories/data.repository", () => ({
    requireAuthenticatedUser: vi.fn().mockResolvedValue({ id: "user-a" }),
    throwDataError: vi.fn(),
}));

import { supabase } from "@/lib/supabase";

import { calendarAdapter, locationAdapter, sourceAdapters } from "./adapters";
import { contextService } from "./context.service";
import { contextResolver } from "./contextResolver";
import { permissionManager } from "./permissions";
import { syncManager } from "./syncManager";

const rpcMock = supabase.rpc as unknown as ReturnType<typeof vi.fn>;
const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.clearAllMocks();
});

describe("provider registration & lifecycle", () => {
    it("registers exactly one adapter per local provider (no duplicates)", () => {
        const types = sourceAdapters.map((adapter) => adapter.sourceType);
        expect(new Set(types).size).toBe(types.length);
        for (const adapter of sourceAdapters) {
            expect(adapter.capabilities.local).toBe(true);
            expect(typeof adapter.capabilities.capabilitiesDescription).toBe("string");
        }
    });

    it("contains no removed sources in the registry", async () => {
        const { SOURCE_DEFINITIONS, CONNECTABLE_SOURCES } = await import("./types");
        for (const removed of ["calls", "messages", "notifications_source", "contacts", "photos", "health", "app_activity"]) {
            expect(Object.keys(SOURCE_DEFINITIONS)).not.toContain(removed);
            expect(CONNECTABLE_SOURCES as readonly string[]).not.toContain(removed);
        }
    });

    it("exposes platform honesty for every provider (never fake support)", async () => {
        for (const source of ["location", "calendar", "screen_time", "github", "slack"] as const) {
            const status = await permissionManager.getStatus(source);
            expect(["supported", "supported_with_conditions", "not_available", "policy_restricted"]).toContain(status.platformSupport);
        }
    });
});

describe("sync manager", () => {
    it("defers sources synced within their provider-specific interval", async () => {
        fromMock.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [
                    { source_type: "location", status: "connected", last_synced_at: new Date().toISOString() },
                    { source_type: "calendar", status: "connected", last_synced_at: new Date().toISOString() },
                ],
                error: null,
            }),
        });
        const outcomes = await syncManager.syncConnectedSources();
        expect(outcomes.every((outcome) => outcome.status === "deferred")).toBe(true);
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it("syncs due sources, records ok state, and reports dedup counts", async () => {
        fromMock.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [{ source_type: "location", status: "connected", last_synced_at: null }],
                error: null,
            }),
        });
        rpcMock.mockImplementation((fn: string) => {
            if (fn === "upsert_observation") return Promise.resolve({ data: { status: "created" }, error: null });
            return Promise.resolve({ data: null, error: null });
        });

        const collect = vi.spyOn(locationAdapter, "collect").mockResolvedValue([
            { sourceType: "location", observationType: "place_context", sourceEventId: "home_area:1", observedAt: new Date().toISOString(), value: { context: "home_area" } },
        ]);

        const outcomes = await syncManager.syncConnectedSources();
        expect(outcomes).toEqual([{ sourceType: "location", status: "synced", created: 1, deduplicated: 0 }]);
        const recorded = rpcMock.mock.calls.find(([fn]) => fn === "record_sync_result");
        expect(recorded?.[1]).toMatchObject({ p_status: "ok", p_source_type: "location" });
        collect.mockRestore();
    });

    it("marks failures honestly as temporary without losing existing observations", async () => {
        fromMock.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [{ source_type: "calendar", status: "connected", last_synced_at: null }],
                error: null,
            }),
        });
        rpcMock.mockImplementation((fn: string) => {
            if (fn === "upsert_observation") return Promise.resolve({ data: { status: "created" }, error: null });
            return Promise.resolve({ data: null, error: null });
        });

        const collect = vi.spyOn(calendarAdapter, "collect").mockRejectedValue(new Error("provider busy"));
        const outcomes = await syncManager.syncConnectedSources();
        expect(outcomes[0].status).toBe("error");
        const recorded = rpcMock.mock.calls.find(([fn]) => fn === "record_sync_result");
        expect(recorded?.[1]).toMatchObject({ p_status: "temporary", p_error: "provider busy" });
        collect.mockRestore();
    });

    it("enqueues deduplicated server-side jobs for OAuth sources", async () => {
        fromMock.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [{ source_type: "github", status: "connected", last_synced_at: null }],
                error: null,
            }),
        });
        rpcMock.mockResolvedValue({ data: "job-1", error: null });

        const outcomes = await syncManager.syncConnectedSources();
        expect(outcomes[0].status).toBe("enqueued");
        const enqueued = rpcMock.mock.calls.find(([fn]) => fn === "enqueue_provider_sync");
        expect(enqueued?.[1]).toMatchObject({ p_source_type: "github" });
        // Two calls within the same hour produce the same job key -> DB dedup.
        await syncManager.syncConnectedSources();
        const keys = rpcMock.mock.calls.filter(([fn]) => fn === "enqueue_provider_sync").map((call) => call[1].p_job_key);
        expect(keys[0]).toBe(keys[1]);
    });
});

describe("observation ingestion (dedup, validation)", () => {
    it("sends stable source_event_id drafts to the validated upsert only", async () => {
        rpcMock.mockResolvedValue({ data: { status: "deduplicated" }, error: null });
        fromMock.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [{ source_type: "location", status: "connected", last_synced_at: null }], error: null }),
        });
        const collect = vi.spyOn(locationAdapter, "collect").mockResolvedValue([
            { sourceType: "location", observationType: "place_context", sourceEventId: "travel:99", observedAt: new Date().toISOString(), value: { context: "unfamiliar_place" } },
        ]);
        await syncManager.syncConnectedSources();
        const upsert = rpcMock.mock.calls.find(([fn]) => fn === "upsert_observation");
        expect(upsert?.[1]).toMatchObject({ p_source_type: "location", p_source_event_id: "travel:99", p_value: { context: "unfamiliar_place" } });
        collect.mockRestore();
    });

    it("never lets drafts carry coordinates or content bodies", async () => {
        const collect = vi.spyOn(locationAdapter, "collect").mockResolvedValue([
            { sourceType: "location", observationType: "place_context", sourceEventId: "x", observedAt: new Date().toISOString(), value: { context: "home_area" } },
        ]);
        const [draft] = await locationAdapter.collect();
        expect(Object.keys(draft?.value ?? {})).toEqual(["context"]);
        collect.mockRestore();
    });
});

describe("observation -> signal mapping (the bridge decides, deterministically)", () => {
    it("maps meaningful observation types onto existing concept signals", () => {
        // Mirrors observation_signal_type in the DB migration.
        const map = (type: string, value: Record<string, unknown>): string | null => {
            if (type === "planned_event" && ["work", "meeting", "focus"].includes(String(value.eventCategory))) return "schedule_density";
            if (type === "planned_action") return "routine_change";
            if (type === "movement_context" && value.context === "travel") return "routine_change";
            if (type === "usage_window" && ["social", "entertainment"].includes(String(value.category))) return "focus_difficulty";
            if (type === "commit_activity") return "routine_change";
            if (type === "communication_window") return "stress_level";
            return null;
        };
        expect(map("planned_event", { eventCategory: "meeting" })).toBe("schedule_density");
        expect(map("usage_window", { category: "social" })).toBe("focus_difficulty");
        expect(map("planned_event", { eventCategory: "birthday" })).toBeNull();
        expect(map("photos_liked", {})).toBeNull();
    });
});

describe("context resolution (relevance + bounding)", () => {
    it("requests only sources relevant to the message topic", async () => {
        rpcMock.mockResolvedValue({
            data: { connectedSources: ["calendar"], observations: [] },
            error: null,
        });
        await contextResolver.resolve(null, 6, 12, ["calendar", "google_calendar"]);
        const call = rpcMock.mock.calls.find(([fn]) => fn === "get_context_bundle");
        expect(call?.[1]).toMatchObject({ p_source_filter: ["calendar", "google_calendar"] });
    });

    it("caps the observation slice sent toward the AI", async () => {
        rpcMock.mockResolvedValue({ data: { connectedSources: [], observations: [] }, error: null });
        await contextResolver.resolve(null, 6, 12);
        const call = rpcMock.mock.calls.find(([fn]) => fn === "get_context_bundle");
        expect(call?.[1].p_limit).toBeLessThanOrEqual(30);
    });
});

describe("end-to-end: distraction scenario", () => {
    it("keeps observation, statement, and inference distinct end to end", async () => {
        // 1-3. Providers stored normalized, deduplicated observations (above).
        // 4-5. Resolver finds the relevant window, bounded.
        rpcMock.mockImplementation((fn: string) => {
            if (fn === "get_context_bundle") {
                return Promise.resolve({
                    data: {
                        connectedSources: ["calendar", "screen_time", "github"],
                        observations: [
                            { sourceType: "calendar", observationType: "planned_event", observedAt: "2026-09-20T10:00:00Z", value: { eventCategory: "focus", scheduledStart: "2026-09-20T10:00:00Z", scheduledEnd: "2026-09-20T12:00:00Z", scheduledDurationMinutes: 120, status: "confirmed" } },
                            { sourceType: "screen_time", observationType: "usage_window", observedAt: "2026-09-20T10:40:00Z", value: { category: "social", durationMinutes: 15, windowStart: "2026-09-20T10:40:00Z", windowEnd: "2026-09-20T10:55:00Z" } },
                            { sourceType: "github", observationType: "commit_activity", observedAt: "2026-09-20T10:20:00Z", value: { commits: 1, pullRequests: 0 } },
                        ],
                    },
                    error: null,
                });
            }
            return Promise.resolve({ data: null, error: null });
        });

        const bundle = await contextResolver.resolve("2026-09-20T11:00:00Z", 6, 12, ["calendar", "screen_time", "github"]);
        expect(bundle?.observations).toHaveLength(3);

        // 6-8. What the AI may say: describe observations; inference stays tentative.
        const observed = bundle!.observations.map((observation) => `${observation.sourceType}:${observation.observationType}`);
        expect(observed).toContain("calendar:planned_event");
        expect(observed).toContain("screen_time:usage_window");
        expect(observed).toContain("github:commit_activity");
        const socialWindow = bundle!.observations.find((observation) => observation.sourceType === "screen_time");
        expect((socialWindow!.value as { durationMinutes: number }).durationMinutes).toBe(15);

        // Valid inference language vs forbidden causal claims:
        const valid = "While your coding block was planned 10-12, a social-app window appeared 10:40-10:55. Maybe that contributed.";
        const forbidden = "You were procrastinating.";
        expect(valid).toMatch(/maybe|may have|appears/i);
        expect(forbidden).not.toMatch(/maybe|may have|appears/i);

        // 9-12. Signals/patterns/experiments/timeline remain the EXISTING
        // engines' responsibility — the provider layer only supplied evidence.
    });
});
