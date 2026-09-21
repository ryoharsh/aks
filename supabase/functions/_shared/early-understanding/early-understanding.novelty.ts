import { assessEarlyUnderstanding } from "./early-understanding.service.ts";
import type { EarlySignal, EarlyUnderstanding } from "./early-understanding.types.ts";

export type RecentMessageLike = {
    role: string;
    content: string;
};

export type SupportedPatternLike = {
    title: string;
    description: string;
};

const RECENT_ASSISTANT_WINDOW = 6;
const NOTICE_MARKER = "i noticed";
const WATCH_MARKER = "i'll keep watching";

const STOPWORDS = new Set([
    "you", "your", "said", "were", "with", "later", "and", "the", "that",
    "this", "have", "has", "from", "they", "them", "seem", "right",
]);

function significantWords(phrase: string): string[] {
    return phrase
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 4 && !STOPWORDS.has(word));
}

/** Strip the deterministic wrapper to get the factual core for comparison. */
function factualCore(noticeText: string): string[] {
    let core = noticeText.toLowerCase();
    core = core.replace(/^i noticed\s+/, "");
    core = core.replace(/\s*i don't know if they're connected yet,?\s*(but i'll keep watching\.?)?\s*$/, "");
    core = core.replace(/\s*they seem mixed right now,?\s*(so i won't assume they're connected\.?)?\s*(i'll keep watching\.?)?\s*$/, "");
    core = core.replace(/\s*i'll keep watching\.?\s*$/, "");
    core = core.replace(/\.\s*$/, "");
    return core.split(/\s+and later\s+|\s*,\s*and later\s+|\s*,\s*/).map((part) => part.trim()).filter(Boolean);
}

/**
 * NOVELTY: suppress an early notice when the same observation was already
 * surfaced in recent assistant messages. Signal-only inputs + text
 * containment — never fabricates, never reads raw user text beyond what
 * Mirror already rendered.
 */
export function wasAlreadySurfaced(
    noticeText: string,
    recentMessages: RecentMessageLike[],
): boolean {
    if (!noticeText) return false;
    const assistants = recentMessages
        .filter((message) => message.role === "assistant" && typeof message.content === "string")
        .slice(-RECENT_ASSISTANT_WINDOW)
        .map((message) => message.content.toLowerCase());
    if (!assistants.length) return false;

    const lowered = noticeText.toLowerCase();
    // Verbatim (or near-verbatim) repeat.
    if (assistants.some((content) => content.includes(lowered) || lowered.includes(content.slice(0, 120)))) return true;

    const cores = factualCore(noticeText);
    if (!cores.length) return false;
    // Every factual phrase must already be represented; a partially-new
    // observation (new concept added) is NOT a duplicate.
    return cores.every((phrase) => {
        const words = significantWords(phrase);
        if (!words.length) return true;
        if (assistants.some((content) => content.includes(phrase))) return true;
        // Same concept already noticed ("chaos" twice across turns).
        return words.some((word) => assistants.some((content) => content.includes(NOTICE_MARKER) && content.includes(word)));
    });
}

/**
 * CONTINUITY: suppress an early notice when a formal supported/possible
 * pattern already covers the same concepts — the pattern owns the story now.
 * Matches only on deterministic signal wording appearing in the pattern's
 * title/description; never invents coverage.
 */
export function isCoveredByFormalPattern(
    noticeText: string,
    supportedPatterns: SupportedPatternLike[],
): boolean {
    if (!noticeText || !supportedPatterns.length) return false;
    const patterns = supportedPatterns
        .filter((pattern) => pattern && typeof pattern.title === "string")
        .map((pattern) => `${pattern.title} ${pattern.description ?? ""}`.toLowerCase());
    if (!patterns.length) return false;
    const cores = factualCore(noticeText);
    if (!cores.length) return false;
    return cores.every((phrase) => {
        const words = significantWords(phrase);
        if (!words.length) return true;
        if (patterns.some((text) => text.includes(phrase))) return true;
        return words.some((word) => patterns.some((text) => text.includes(word)));
    });
}

export function hasPriorEarlyWatch(recentMessages: RecentMessageLike[]): boolean {
    return recentMessages
        .filter((message) => message.role === "assistant")
        .slice(-RECENT_ASSISTANT_WINDOW)
        .some((message) => typeof message.content === "string" && message.content.toLowerCase().includes(WATCH_MARKER));
}

/**
 * Resolve what Mirror should receive:
 * - pattern_ready/insufficient → null (explicit handoff: formal patterns in
 *   `supportedPatterns` speak; the Pattern Engine remains sole gatekeeper).
 * - notice/emerging/contradictory → text, unless already surfaced (novelty)
 *   or covered by a formal pattern (continuity) → null + deduplicated:true.
 */
export function resolveEarlyUnderstanding(input: {
    signals: EarlySignal[];
    recentMessages?: RecentMessageLike[];
    supportedPatterns?: SupportedPatternLike[];
}): EarlyUnderstanding {
    const recentMessages = input.recentMessages ?? [];
    const supportedPatterns = input.supportedPatterns ?? [];
    const early = assessEarlyUnderstanding(input.signals);
    if (!early.noticeText) return early;
    if (wasAlreadySurfaced(early.noticeText, recentMessages)) {
        return { ...early, noticeText: null, deduplicated: true };
    }
    if (isCoveredByFormalPattern(early.noticeText, supportedPatterns)) {
        return { ...early, noticeText: null, deduplicated: true };
    }
    return early;
}
