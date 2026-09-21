import { resolveResponseLanguage } from "./languages.ts";

export type MirrorContext = {
    currentMessage: string;
    conversation: { title: string };
    recentMessages: Array<{ role: "user" | "assistant" | "system"; content: string; createdAt: string }>;
    recentSignals: Array<{ signalType: string; value: unknown; observedAt: string }>;
    activeMemories: Array<{ content: string; memoryType: string; lastObservedAt: string }>;
    supportedPatterns: Array<{ title: string; description: string; status: string; evidenceCount: number; lastObservedAt: string }>;
    activeExperiments: Array<{ title: string; hypothesis: string; status: string; startDate: string | null; endDate: string | null }>;
    relevantLearnings: Array<{ title: string; description: string; status: string; confidence: number | null }>
    /**
     * The user's stored preference language, as a raw code. Optional so a
     * context can be built from a partial preference row (or a test fixture)
     * without one; absence resolves to English.
     */
    preferences: { whatExploring: string[]; whatToNotice: string[]; language?: string | null };
    contextSources: string[];
    relevantObservations: Array<{ sourceType: string; observationType: string; observedAt: string; value: unknown }>;
    /** Early-understanding notice (signal-grounded, never a formal pattern). */
    earlyUnderstanding?: { level: string; noticeText: string } | null;
};

export function buildMirrorContext(input: MirrorContext) {
    const safe = <T,>(values: T[] | undefined | null): T[] => values ?? [];
    return {
        currentMessage: input.currentMessage.slice(0, 12000),
        conversation: input.conversation,
        recentMessages: safe(input.recentMessages).slice(-12).map((message) => ({
            ...message,
            content: message.content.slice(0, 2000),
        })),
        recentSignals: safe(input.recentSignals).slice(0, 8),
        activeMemories: safe(input.activeMemories).slice(0, 6).map((memory) => ({ ...memory, content: memory.content.slice(0, 500) })),
        supportedPatterns: safe(input.supportedPatterns).slice(0, 4).map((pattern) => ({ ...pattern, description: pattern.description.slice(0, 300) })),
        activeExperiments: safe(input.activeExperiments).slice(0, 3),
        relevantLearnings: safe(input.relevantLearnings).slice(0, 3).map((learning) => ({ ...learning, description: learning.description.slice(0, 300) })),
        // Personal context: only connected sources' coarse observations are
        // included, and the model is told to treat them as observed context,
        // never as proof of motivation or character.
        contextSources: safe(input.contextSources).slice(0, 6),
        relevantObservations: safe(input.relevantObservations).slice(0, 8),
        // Early understanding: deterministic signal-grounded notice only.
        // Never a formal pattern; Mirror may reflect its wording gently.
        earlyUnderstanding: input.earlyUnderstanding?.noticeText
            ? { level: input.earlyUnderstanding.level.slice(0, 20), noticeText: input.earlyUnderstanding.noticeText.slice(0, 500) }
            : null,
        preferences: {
            whatExploring: input.preferences.whatExploring.slice(0, 5).map((value) => value.slice(0, 100)),
            whatToNotice: input.preferences.whatToNotice.slice(0, 5).map((value) => value.slice(0, 100)),
        },
        // The language the reply must be written in. Kept beside `preferences`
        // rather than inside it: preferences describe what the user wants Aks
        // to focus on, and the instructions explicitly forbid treating them as
        // evidence, whereas this is an instruction about the reply itself.
        responseLanguage: resolveResponseLanguage(input.preferences.language),
    };
}
