import type { EarlyLevel, EarlySignal, EarlyUnderstanding } from "./early-understanding.types.ts";

/**
 * EARLY UNDERSTANDING layer (signal → notice → emerging → Pattern Engine).
 *
 * Intentionally conservative and deterministic:
 * - Reads ONLY signals (check-ins, conversations, connected-source bridge).
 *   Never reads raw conversation text.
 * - Never creates formal patterns. `pattern_ready` means "stay silent and let
 *   the existing Pattern Engine decide with its 3+ evidence gate".
 * - Never fabricates evidence, numbers, confidence, or relationships. Counts
 *   ("twice") are derived only from real supplied signals.
 * - Never uses causal language or the word "pattern" in user-facing text.
 */

const relatedSignalTypes: Record<string, string[]> = {
    difficulty_starting: ["avoidance", "motivation_change", "stress_level"],
    focus_difficulty: ["energy_change", "sleep_quality", "stress_level", "routine_change"],
    energy_change: ["sleep_quality", "focus_difficulty", "mood_state", "mood_observation"],
    sleep_quality: ["energy_change", "focus_difficulty", "mood_state", "stress_level", "mood_observation"],
    mood_state: ["energy_change", "sleep_quality", "stress_level", "motivation_change", "mood_observation"],
    stress_level: ["focus_difficulty", "sleep_quality", "avoidance", "mood_state", "mood_observation"],
    routine_change: ["focus_difficulty", "energy_change", "motivation_change"],
    avoidance: ["difficulty_starting", "stress_level", "motivation_change"],
    mood_observation: ["sleep_quality", "energy_change", "stress_level", "focus_difficulty", "mood_state", "motivation_change"],
    motivation_change: ["difficulty_starting", "energy_change", "mood_state", "avoidance", "mood_observation"],
};

const forbiddenInText = /\b(patterns?|causes?|caused|proves?|proof|guarantees?|diagnos(?:is|ed|tic)|disorder|cures?)\b/i;

function stableValue(value: unknown): string {
    if (value === null || value === undefined) return "{}";
    if (typeof value !== "object") return JSON.stringify(value);
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return JSON.stringify(Object.fromEntries(keys.map((key) => [key, record[key]])));
}

function conceptKey(signal: EarlySignal): string {
    return `${signal.signalType}:${stableValue(signal.value)}`;
}

function sourceKeyOf(signal: EarlySignal, index: number): string {
    if (signal.sourceKey) return signal.sourceKey;
    return `${signal.observedAt}|${signal.signalType}|${stableValue(signal.value)}|${index}`;
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/** Map a signal to a coarse polarity for contradiction detection. Null = neutral/skip. */
function polarity(signal: EarlySignal): "low" | "high" | null {
    const value = asRecord(signal.value);
    switch (signal.signalType) {
        case "mood_observation": {
            if (value.mood === "Chaos") return "low";
            if (value.mood === "Good") return "high";
            return null;
        }
        case "mood_state": {
            if (value.state === "low") return "low";
            if (value.state === "positive") return "high";
            return null;
        }
        case "stress_level": {
            if (value.level === "high") return "low";
            if (value.level === "low") return "high";
            return null;
        }
        case "energy_change": {
            if (value.direction === "lower") return "low";
            if (value.direction === "higher") return "high";
            return null;
        }
        case "sleep_quality": {
            if (value.quality === "worse") return "low";
            if (value.quality === "better") return "high";
            return null;
        }
        case "difficulty_starting":
        case "avoidance": {
            if (value.present === true) return "low";
            if (value.present === false) return "high";
            return null;
        }
        case "focus_difficulty": {
            if (value.present === true) return "low";
            if (value.present === false) return "high";
            return null;
        }
        case "motivation_change": {
            if (value.direction === "lower") return "low";
            if (value.direction === "higher") return "high";
            return null;
        }
        default:
            return null;
    }
}

function areRelated(a: string, b: string): boolean {
    if (a === b) return true;
    return relatedSignalTypes[a]?.includes(b) || relatedSignalTypes[b]?.includes(a) || false;
}

function shortPhrase(signal: EarlySignal): string {
    const value = asRecord(signal.value);
    switch (signal.signalType) {
        case "mood_observation":
            return typeof value.mood === "string" ? `you reported ${String(value.mood).toLowerCase()}` : "you checked in";
        case "mood_state":
            if (value.state === "low") return "you said you were feeling sad";
            if (value.state === "positive") return "you said you were feeling positive";
            return "you mentioned your mood";
        case "stress_level":
            return typeof value.level === "string" ? `you mentioned ${String(value.level)} stress` : "you mentioned stress";
        case "energy_change":
            return typeof value.direction === "string" ? `${String(value.direction)} energy` : "your energy";
        case "sleep_quality":
            return typeof value.quality === "string" ? `${String(value.quality)} sleep` : "your sleep";
        case "difficulty_starting":
            return value.present === false ? "starting without reported difficulty" : "difficulty getting started";
        case "focus_difficulty":
            return "focus difficulty";
        case "avoidance":
            return value.present === false ? "approaching tasks" : "putting things off";
        case "motivation_change":
            return typeof value.direction === "string" ? `${String(value.direction)} motivation` : "your motivation";
        case "routine_change":
            return value.changed === false ? "a stable routine" : "a routine change";
        default:
            return signal.signalType.replaceAll("_", " ");
    }
}

function countWord(count: number): string {
    return count === 2 ? "twice" : count === 3 ? "three times" : `${count} times`;
}

/** Group identical phrases: "you reported chaos" x2 → "you reported chaos twice". */
function factualList(signals: EarlySignal[]): string {
    const groups = new Map<string, number>();
    for (const signal of signals) {
        const phrase = shortPhrase(signal);
        groups.set(phrase, (groups.get(phrase) ?? 0) + 1);
    }
    const parts = [...groups.entries()].map(([phrase, count]) =>
        count > 1 ? `${phrase} ${countWord(count)}` : phrase,
    );
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and later ${parts[1]}`;
    return `${parts.slice(0, -1).join(", ")}, and later ${parts[parts.length - 1]}`;
}

export function isSafeEarlyText(text: string): boolean {
    if (!text || text.length > 500) return false;
    if (forbiddenInText.test(text)) return false;
    return true;
}

export function assessEarlyUnderstanding(signals: EarlySignal[]): EarlyUnderstanding {
    const list = Array.isArray(signals) ? signals : [];
    if (!list.length) return { level: "insufficient", noticeText: null, signalCount: 0, distinctSources: 0 };

    const distinctKeys = new Set(list.map((signal, index) => sourceKeyOf(signal, index)));
    const distinctSources = distinctKeys.size;

    const polarities = new Set(list.map(polarity).filter((value) => value !== null));
    const hasContradiction = polarities.has("low") && polarities.has("high");
    if (hasContradiction && list.length >= 2) {
        const text = `I noticed ${factualList(list)}. They seem mixed right now, so I won't assume they're connected. I'll keep watching.`;
        if (!isSafeEarlyText(text)) return { level: "contradictory", noticeText: null, signalCount: list.length, distinctSources };
        return { level: "contradictory", noticeText: text, signalCount: list.length, distinctSources };
    }

    // Formal-pattern gate stays with the Pattern Engine: only an exact concept
    // repeated across 3+ distinct sources defers. Mixed types (e.g. 2x Chaos +
    // sad) stay at "emerging" — never a formal pattern from this layer.
    const perConcept = new Map<string, Set<string>>();
    list.forEach((signal, index) => {
        const key = conceptKey(signal);
        const group = perConcept.get(key) ?? new Set<string>();
        group.add(sourceKeyOf(signal, index));
        perConcept.set(key, group);
    });
    const sameConceptMax = Math.max(...[...perConcept.values()].map((group) => group.size));
    if (sameConceptMax >= 3) {
        return { level: "pattern_ready", noticeText: null, signalCount: list.length, distinctSources };
    }

    if (distinctSources >= 2 && list.length >= 2) {
        const types = [...new Set(list.map((signal) => signal.signalType))];
        const related = types.length === 1 || types.some((a, i) => types.slice(i + 1).some((b) => areRelated(a, b)));
        if (related) {
            const text = `I noticed ${factualList(list)}. I don't know if they're connected yet, but I'll keep watching.`;
            if (!isSafeEarlyText(text)) return { level: "emerging", noticeText: null, signalCount: list.length, distinctSources };
            return { level: "emerging", noticeText: text, signalCount: list.length, distinctSources };
        }
    }

    if (list.length >= 1 && distinctSources >= 1) {
        // Single observation or unrelated pair: immediate notice, no connection claimed.
        if (list.length === 1) {
            const text = `I noticed ${factualList(list)}.`;
            if (!isSafeEarlyText(text)) return { level: "notice", noticeText: null, signalCount: 1, distinctSources };
            return { level: "notice", noticeText: text, signalCount: 1, distinctSources };
        }
        const text = `I noticed ${factualList(list)}.`;
        if (!isSafeEarlyText(text)) return { level: "notice", noticeText: null, signalCount: list.length, distinctSources };
        return { level: "notice", noticeText: text, signalCount: list.length, distinctSources };
    }

    return { level: "insufficient" satisfies EarlyLevel, noticeText: null, signalCount: list.length, distinctSources };
}
