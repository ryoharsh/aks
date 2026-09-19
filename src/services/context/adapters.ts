import { Platform } from "react-native";
import { permissionManager } from "./permissions";
import type { ContextSourceType, ObservationDraft } from "./types";

/**
 * Source adapters turn permitted raw platform data into minimal normalized
 * observation drafts. Adapters never talk to Supabase and never talk to AI.
 * Restricted or unavailable sources never produce observations.
 *
 * Every adapter also exposes the common provider lifecycle via
 * `capabilities` and `describe` (what/why/stored/stop copy lives in the
 * registry) — one lifecycle for all providers, no per-provider architecture.
 */
export type SourceAdapter = {
    sourceType: ContextSourceType;
    collect(): Promise<ObservationDraft[]>;
};

export type ProviderAdapter = SourceAdapter & {
    /** What this provider can offer — one lifecycle for every provider. */
    capabilities: {
        /** True when the adapter collects on-device (OS path). */
        local: boolean;
        /** Whether the provider supports incremental sync checkpoints. */
        incremental: boolean;
        /** Human explanation shown at the moment of value. */
        capabilitiesDescription: string;
    };
};

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

/** Very coarse place classification — no coordinates leave the adapter. */
function classifyPlace(lat: number, lon: number, significantPlaces: Array<{ latitude: number; longitude: number; label: string }>, radiusMeters = 150): string {
    let best: { label: string; distance: number } | null = null;
    for (const place of significantPlaces) {
        const dLat = ((place.latitude - lat) * Math.PI) / 180;
        const dLon = ((place.longitude - lon) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((place.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
        const distance = 6371000 * 2 * Math.asin(Math.sqrt(a));
        if (!best || distance < best.distance) best = { label: place.label, distance };
    }
    if (!best || best.distance > radiusMeters) return "unfamiliar_place";
    return best.label;
}

export const locationAdapter: ProviderAdapter = {
    sourceType: "location",
    capabilities: {
        local: true,
        incremental: false,
        capabilitiesDescription: "Coarse place and movement context in 30-minute windows; no coordinates.",
    },
    async collect(): Promise<ObservationDraft[]> {
        const status = await permissionManager.getStatus("location");
        if (status.permissionState !== "granted") return [];
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const Location = require("expo-location");
            const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const significant = (await Location.getReverseGeocodingAsync?.(position.coords)) ?? null;
            void significant;
            const context = classifyPlace(
                position.coords.latitude,
                position.coords.longitude,
                // Significant places are user-configurable in settings; none are
                // configured by default, so an unconfigured setup reports only
                // an unfamiliar-place/movement bucket — never a raw location.
                [],
            );
            const draft: ObservationDraft = {
                sourceType: "location",
                observationType: "place_context",
                // The event id is a stable function of the coarse bucket + 30-min
                // window, so the same context never duplicates.
                sourceEventId: `${context}:${Math.floor(position.timestamp / (30 * 60000))}`,
                observedAt: new Date(position.timestamp).toISOString(),
                value: { context },
            };
            return [draft];
        } catch {
            return [];
        }
    },
};

type CalendarEventDraft = {
    id: string;
    title: string | null;
    startDate: string;
    endDate: string;
    status: string | null;
};

function eventCategory(title: string | null): string {
    if (!title) return "general";
    const lower = title.toLowerCase();
    if (/(study|work|focus|deep)/.test(lower)) return "focus";
    if (/(gym|workout|training|run)/.test(lower)) return "fitness";
    if (/(meet|standup|sync|1:1|review)/.test(lower)) return "meeting";
    if (/(travel|flight|trip|commute)/.test(lower)) return "travel";
    return "general";
}

export const calendarAdapter: ProviderAdapter = {
    sourceType: "calendar",
    capabilities: {
        local: true,
        incremental: false,
        capabilitiesDescription: "Event times and categories in a bounded window (12h past, 24h ahead).",
    },
    async collect(): Promise<ObservationDraft[]> {
        const status = await permissionManager.getStatus("calendar");
        if (status.permissionState !== "granted") return [];
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const Calendar = require("expo-calendar");
            const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
            const writable = calendars.filter((calendar: { allowsModifications: boolean; id: string }) => calendar.allowsModifications).map((calendar: { id: string }) => calendar.id);
            const sourceCalendarIds = writable.length > 0 ? writable : calendars.map((calendar: { id: string }) => calendar.id);
            const now = Date.now();
            const events: CalendarEventDraft[] = await Calendar.getEventsAsync(sourceCalendarIds, now - 12 * 3600000, now + 24 * 3600000);
            return events.slice(0, 20).map((event) => {
                const start = new Date(event.startDate);
                const durationMinutes = Math.max(0, Math.round((new Date(event.endDate).getTime() - start.getTime()) / 60000));
                return {
                    sourceType: "calendar" as const,
                    observationType: "planned_event",
                    sourceEventId: `cal:${event.id}`,
                    observedAt: start.toISOString(),
                    value: {
                        eventCategory: eventCategory(event.title),
                        scheduledStart: event.startDate,
                        scheduledEnd: event.endDate,
                        scheduledDurationMinutes: durationMinutes,
                        status: event.status === "canceled" ? "cancelled" : "confirmed",
                    },
                };
            });
        } catch {
            return [];
        }
    },
};

export const sourceAdapters: ProviderAdapter[] = [locationAdapter, calendarAdapter];
