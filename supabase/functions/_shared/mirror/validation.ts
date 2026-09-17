const signalSchemas: Record<string, (value: Record<string, unknown>) => boolean> = {
    difficulty_starting: (value) => exact(value, ["present"]) && typeof value.present === "boolean",
    focus_difficulty: (value) => exact(value, ["present", "period"]) && typeof value.present === "boolean" && optionalEnum(value.period, ["morning", "afternoon", "evening", "unspecified"]),
    energy_change: (value) => exact(value, ["direction"]) && enumValue(value.direction, ["higher", "lower", "variable"]),
    sleep_quality: (value) => exact(value, ["quality"]) && enumValue(value.quality, ["better", "worse", "mixed"]),
    mood_state: (value) => exact(value, ["state"]) && enumValue(value.state, ["positive", "neutral", "low", "mixed"]),
    stress_level: (value) => exact(value, ["level"]) && enumValue(value.level, ["low", "moderate", "high"]),
    routine_change: (value) => exact(value, ["changed"]) && typeof value.changed === "boolean",
    avoidance: (value) => exact(value, ["present"]) && typeof value.present === "boolean",
    motivation_change: (value) => exact(value, ["direction"]) && enumValue(value.direction, ["higher", "lower", "variable"]),
};

function exact(value: Record<string, unknown>, allowedKeys: string[]) {
    return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function enumValue(value: unknown, allowed: string[]) {
    return typeof value === "string" && allowed.includes(value);
}

function optionalEnum(value: unknown, allowed: string[]) {
    return value === undefined || enumValue(value, allowed);
}

export type ValidatedSignal = {
    signalType: string;
    value: Record<string, unknown>;
    confidence: number | null;
};

function parseJson(content: string): unknown {
    const normalized = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return JSON.parse(normalized);
}

export function validateConversationResponse(content: string) {
    let value: Record<string, unknown>;
    try {
        value = parseJson(content) as Record<string, unknown>;
    } catch {
        throw new Error("INVALID_AI_RESPONSE");
    }
    const response = value?.response as Record<string, unknown> | undefined;
    const safety = value?.safety as Record<string, unknown> | undefined;
    if (!safety || (safety.risk !== "none" && safety.risk !== "imminent")) {
        throw new Error("INVALID_AI_RESPONSE");
    }
    if (!response || typeof response.text !== "string" || !response.text.trim() || response.text.length > 4000) {
        throw new Error("INVALID_AI_RESPONSE");
    }
    const followUp = value.followUp;
    if (followUp !== null && followUp !== undefined && (typeof followUp !== "string" || followUp.length > 500)) {
        throw new Error("INVALID_AI_RESPONSE");
    }
    return { safety: { risk: safety.risk }, response: { text: response.text.trim() }, followUp: typeof followUp === "string" && followUp.trim() ? followUp.trim() : null };
}

export function validateSignals(content: string): ValidatedSignal[] {
    const value = parseJson(content) as Record<string, unknown>;
    if (!Array.isArray(value?.signals)) throw new Error("INVALID_AI_SIGNALS");

    const seen = new Set<string>();
    return value.signals.slice(0, 3).flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object") return [];
        const signal = candidate as Record<string, unknown>;
        if (typeof signal.signalType !== "string" || seen.has(signal.signalType)) return [];
        if (!signal.value || typeof signal.value !== "object" || Array.isArray(signal.value)) return [];
        const objectValue = signal.value as Record<string, unknown>;
        if (!signalSchemas[signal.signalType]?.(objectValue) || JSON.stringify(objectValue).length > 512) return [];
        const confidence = signal.confidence;
        if (confidence !== null && confidence !== undefined && (typeof confidence !== "number" || confidence < 0 || confidence > 1)) return [];
        seen.add(signal.signalType);
        return [{ signalType: signal.signalType, value: objectValue, confidence: typeof confidence === "number" ? confidence : null }];
    });
}
