import { aiService } from "../ai/ai.service.ts";
import type { AIRequest, AIResult } from "../ai/types.ts";
import type { MemoryRepository } from "../memory/memory.repository.ts";
import { evaluateMemory } from "../memory/memory.service.ts";
import type { PatternRepository } from "../pattern/pattern.repository.ts";
import { analyzePatterns } from "../pattern/pattern.service.ts";

export type ReflectionProcessingResult = {
    signalsSaved: number;
    signals: Array<{ signalType: string; value: Record<string, unknown>; confidence: number | null }>;
    memoryCandidates: Array<{ action: "created" | "updated"; memoryId: string; status: string }>;
    patternActions: Array<{ action: "created" | "updated"; patternId: string; status: string }>;
};

const emptyResult: ReflectionProcessingResult = { signalsSaved: 0, signals: [], memoryCandidates: [], patternActions: [] };

export type ReflectionRepository = {
    getReflection(reflectionId: string): Promise<{ id: string; content: string; createdAt: string }>;
    getSignalsForSource(sourceType: "reflection", sourceId: string): Promise<Array<{ id: string; signalType: string; value: Record<string, unknown>; confidence: number | null; observedAt: string }>>;
    saveSignals(input: { sourceId: string; observedAt: string; signals: Array<{ signalType: string; value: Record<string, unknown>; confidence: number | null }> }): Promise<Array<{ id: string; signalType: string; value: Record<string, unknown>; confidence: number | null; observedAt: string }>>;
    claimRun(input: { reflectionId: string; task: string }): Promise<{ id: string; status: string }>;
    updateRun(id: string, values: Record<string, unknown>): Promise<void>;
    reconcileRun(reflectionId: string, task: string): Promise<void>;
};

export async function processReflection(input: {
    repository: ReflectionRepository;
    memoryRepository?: MemoryRepository;
    patternRepository?: PatternRepository;
    reflectionId: string;
    ai?: { generate(request: AIRequest): Promise<AIResult> };
}): Promise<ReflectionProcessingResult> {
    const ai = input.ai ?? aiService;
    try {
        const reflection = await input.repository.getReflection(input.reflectionId);

        const extractSignals = async () => {
            try {
                const existing = await input.repository.getSignalsForSource("reflection", input.reflectionId);
                if (existing.length) {
                    await input.repository.reconcileRun(input.reflectionId, "signal_extraction").catch(() => undefined);
                    return existing;
                }
                const claim = await input.repository.claimRun({ reflectionId: input.reflectionId, task: "signal_extraction" });
                if (claim.status === "succeeded") return [];
                try {
                    const result = await ai.generate({ ...reflectionSignalExtractionTask, context: { reflection: reflection.content } });
                    const signals = validateReflectionSignals(result.content);
                    if (!signals.length) {
                        await input.repository.updateRun(claim.id, successfulRun(result));
                        return [];
                    }
                    const saved = await input.repository.saveSignals({ sourceId: input.reflectionId, observedAt: reflection.createdAt, signals });
                    await input.repository.updateRun(claim.id, successfulRun(result));
                    return saved;
                } catch (error) {
                    await input.repository.updateRun(claim.id, {
                        status: "failed",
                        error_code: error instanceof Error ? error.message.slice(0, 80) : "SIGNAL_EXTRACTION_FAILED",
                        completed_at: new Date().toISOString(),
                    }).catch(() => undefined);
                    throw error;
                }
            } catch (error) {
                if (error instanceof Error && error.message === "RATE_LIMITED") throw error;
                return [];
            }
        };

        const signals = await extractSignals();

        const processMemory = async () => {
            if (!input.memoryRepository || !signals.length) return [];
            try {
                const result = await evaluateMemory({
                    repository: input.memoryRepository,
                    ai,
                    conversationId: null,
                    userMessageId: null,
                    reflectionId: input.reflectionId,
                    observedAt: reflection.createdAt,
                    currentSignals: signals,
                });
                return result.action === "no_action" ? [] : [result];
            } catch {
                return [];
            }
        };

        const processPatterns = async () => {
            if (!input.patternRepository || !signals.length) return [];
            try {
                return await analyzePatterns({
                    repository: input.patternRepository,
                    ai,
                    conversationId: null,
                    userMessageId: null,
                    reflectionId: input.reflectionId,
                    observedAt: reflection.createdAt,
                    currentSignals: signals,
                });
            } catch {
                return [];
            }
        };

        const [memoryCandidates, patternActions] = await Promise.all([processMemory(), processPatterns()]);
        return { signalsSaved: signals.length, signals, memoryCandidates, patternActions };
    } catch (error) {
        if (error instanceof Error && (error.message === "RATE_LIMITED" || error.message === "ATTEMPTS_EXHAUSTED")) throw error;
        return emptyResult;
    }
}

export const reflectionSignalExtractionTask = {
    task: "signal_extraction" as const,
    version: "signal_extraction_v1",
    instructions: `Extract at most 3 clear, directly supported behavioral observations from only the supplied reflection text. Do not diagnose, infer personality, copy the user's text, or turn vague statements into signals. Use only these schemas: difficulty_starting {present:boolean}; focus_difficulty {present:boolean,period?:morning|afternoon|evening|unspecified}; energy_change {direction:higher|lower|variable}; sleep_quality {quality:better|worse|mixed}; mood_state {state:positive|neutral|low|mixed}; stress_level {level:low|moderate|high}; routine_change {changed:boolean}; avoidance {present:boolean}; motivation_change {direction:higher|lower|variable}. Return JSON only: {"signals":[{"signalType":"...","value":{},"confidence":0.0}]}. Return an empty signals array when evidence is weak.`,
};

export function validateReflectionSignals(content: string): Array<{ signalType: string; value: Record<string, unknown>; confidence: number | null }> {
    const value = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as Record<string, unknown>;
    if (!Array.isArray(value?.signals)) throw new Error("INVALID_AI_SIGNALS");
    const seen = new Set<string>();
    return value.signals.slice(0, 3).flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object") return [];
        const signal = candidate as Record<string, unknown>;
        if (typeof signal.signalType !== "string" || seen.has(signal.signalType)) return [];
        if (!signal.value || typeof signal.value !== "object" || Array.isArray(signal.value)) return [];
        const objectValue = signal.value as Record<string, unknown>;
        if (!reflectionSignalSchemas[signal.signalType]?.(objectValue) || JSON.stringify(objectValue).length > 512) return [];
        const confidence = signal.confidence;
        if (confidence !== null && confidence !== undefined && (typeof confidence !== "number" || confidence < 0 || confidence > 1)) return [];
        seen.add(signal.signalType);
        return [{ signalType: signal.signalType, value: objectValue, confidence: typeof confidence === "number" ? confidence : null }];
    });
}

const reflectionSignalSchemas: Record<string, (value: Record<string, unknown>) => boolean> = {
    difficulty_starting: (value) => exactKeys(value, ["present"]) && typeof value.present === "boolean",
    focus_difficulty: (value) => exactKeys(value, ["present", "period"]) && typeof value.present === "boolean" && optionalEnum(value.period, ["morning", "afternoon", "evening", "unspecified"]),
    energy_change: (value) => exactKeys(value, ["direction"]) && enumValue(value.direction, ["higher", "lower", "variable"]),
    sleep_quality: (value) => exactKeys(value, ["quality"]) && enumValue(value.quality, ["better", "worse", "mixed"]),
    mood_state: (value) => exactKeys(value, ["state"]) && enumValue(value.state, ["positive", "neutral", "low", "mixed"]),
    stress_level: (value) => exactKeys(value, ["level"]) && enumValue(value.level, ["low", "moderate", "high"]),
    routine_change: (value) => exactKeys(value, ["changed"]) && typeof value.changed === "boolean",
    avoidance: (value) => exactKeys(value, ["present"]) && typeof value.present === "boolean",
    motivation_change: (value) => exactKeys(value, ["direction"]) && enumValue(value.direction, ["higher", "lower", "variable"]),
};

function exactKeys(value: Record<string, unknown>, allowedKeys: string[]) {
    return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function enumValue(value: unknown, allowed: string[]) {
    return typeof value === "string" && allowed.includes(value);
}

function optionalEnum(value: unknown, allowed: string[]) {
    return value === undefined || enumValue(value, allowed);
}

function successfulRun(result: AIResult) {
    return { status: "succeeded", provider: result.provider, model: result.model, latency_ms: result.latencyMs, input_tokens: result.usage?.inputTokens ?? null, output_tokens: result.usage?.outputTokens ?? null, error_code: null, completed_at: new Date().toISOString() };
}
