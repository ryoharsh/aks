/**
 * Mirror voice input configuration and live-dictation draft composition.
 *
 * Default Mirror experience is text-first with live speech-to-text straight
 * into the composer draft. The legacy audio-recording → server-transcription
 * pipeline is only permitted when explicitly enabled via:
 *
 *   EXPO_PUBLIC_ENABLE_MIRROR_VOICE_RECORDING=true
 *
 * Missing/undefined/"false"/any other value means recording is disabled.
 * Follows the existing `EXPO_PUBLIC_* === "true"` convention (see
 * LoginScreen/RegisterScreen facebookEnabled).
 */

export const MIRROR_VOICE_RECORDING_ENV_KEY =
    "EXPO_PUBLIC_ENABLE_MIRROR_VOICE_RECORDING" as const;

type EnvLike = Record<string, string | undefined>;

/** Explicit boolean parser — never rely on JS truthiness. */
export function isMirrorVoiceRecordingEnabled(
    env: EnvLike = process.env as EnvLike,
): boolean {
    return env[MIRROR_VOICE_RECORDING_ENV_KEY] === "true";
}

/** Which mic pipeline MirrorScreen should use. */
export type MirrorMicMode = "live" | "recording-fallback";

export function resolveMirrorMicMode(enableRecording: boolean): MirrorMicMode {
    return enableRecording ? "recording-fallback" : "live";
}

/**
 * Join recognized text onto an existing base draft with smart spacing:
 * - empty base → recognized as-is (trimmed of leading space)
 * - base ending in whitespace → direct concat
 * - otherwise single-space separated
 */
export function joinWithSpace(base: string, addition: string): string {
    const cleanAddition = (addition ?? "").trimStart();
    if (!cleanAddition.trim()) return base ?? "";
    if (!(base ?? "")) return cleanAddition.trimStart();
    if (/[\s\n]$/.test(base)) return `${base}${cleanAddition}`;
    if (/^\s/.test(addition)) return `${base}${cleanAddition}`;
    return `${base} ${cleanAddition}`;
}

/**
 * Append an incremental final transcript chunk onto previously-finalized
 * text, deduping the provider interim→final transition and cumulative
 * retransmits:
 * - empty chunk → unchanged
 * - chunk equal to previous → unchanged
 * - chunk starting with previous (cumulative) → append only the remainder
 * - previous ending with chunk (duplicate delivery) → unchanged
 * - otherwise space-join
 */
export function appendFinalChunk(previousFinalized: string, finalChunk: string): string {
    const prev = (previousFinalized ?? "").trim();
    const next = (finalChunk ?? "").trim();
    if (!next) return previousFinalized ?? "";
    if (!prev) return next;
    if (next === prev) return prev;
    if (next.startsWith(prev)) {
        const remainder = next.slice(prev.length).trimStart();
        return remainder ? `${prev} ${remainder}` : prev;
    }
    if (prev.endsWith(next)) return prev;
    return `${prev} ${next}`;
}

/**
 * Visible composer value: committed (base + finalized) + interim preview.
 * Interim replaces — it is never appended on top of itself — so the
 * interim→final transition cannot duplicate text, including when the
 * provider re-emits cumulative transcripts.
 */
export function composeLiveDraft(
    base: string,
    finalized: string,
    interim: string,
): string {
    const b = base ?? "";
    const f = (finalized ?? "").trim();
    const i = (interim ?? "").trim();
    let recognized = "";
    if (f && i) {
        if (i === f) recognized = f;
        else if (i.startsWith(f)) recognized = i;
        else if (f.startsWith(i)) recognized = f;
        else if (f.endsWith(i)) recognized = f;
        else recognized = `${f} ${i}`;
    } else {
        recognized = f || i;
    }
    if (!recognized.trim()) return b;
    return joinWithSpace(b, recognized);
}

export type MirrorLiveDraftSnapshot = {
    base: string;
    finalized: string;
    interim: string;
    draft: string;
    listening: boolean;
};

/**
 * Framework-agnostic controller for the live-STT-into-draft flow.
 * Holds committed (base + finalized) and interim separately; the visible
 * draft is always `composeLiveDraft(base, finalized, interim)`.
 *
 * - start() captures the existing manually-typed draft as base (never
 *   destroyed) and begins listening.
 * - handleInterim() replaces the preview (no accumulation → no duplication).
 * - handleFinal() commits via appendFinalChunk and clears interim.
 * - handleManualEdit() folds user typing into base so the next interim
 *   cannot clobber it.
 * - stop()/disposePreservingDraft() end listening, keep text, and never
 *   submit (no send callback exists by design).
 * - The controller never records audio and never calls transcription APIs.
 */
export class MirrorLiveDraftManager {
    private base = "";
    private finalized = "";
    private interim = "";
    private listening = false;

    start(existingDraft: string): MirrorLiveDraftSnapshot {
        this.base = existingDraft ?? "";
        this.finalized = "";
        this.interim = "";
        this.listening = true;
        return this.snapshot();
    }

    handleInterim(text: string): MirrorLiveDraftSnapshot {
        if (!this.listening) return this.snapshot();
        this.interim = (text ?? "").trim();
        return this.snapshot();
    }

    handleFinal(text: string): MirrorLiveDraftSnapshot {
        if (!this.listening) return this.snapshot();
        const clean = (text ?? "").trim();
        if (clean) this.finalized = appendFinalChunk(this.finalized, clean);
        this.interim = "";
        return this.snapshot();
    }

    /** User typed while listening: fold the edit into base. */
    handleManualEdit(newDraftValue: string): MirrorLiveDraftSnapshot {
        if (!this.listening) {
            this.base = newDraftValue ?? "";
            return this.snapshot();
        }
        const value = newDraftValue ?? "";
        if (this.interim && value.endsWith(this.interim)) {
            this.base = value.slice(0, value.length - this.interim.length);
        } else {
            this.base = value;
        }
        this.finalized = "";
        return this.snapshot();
    }

    /** Mic toggle off: commit nothing new, keep text, stop listening. */
    stop(): MirrorLiveDraftSnapshot {
        this.listening = false;
        this.interim = "";
        return this.snapshot();
    }

    /** Blur/unmount: end listening, keep the visible text as-is. */
    disposePreservingDraft(): { draft: string; listening: boolean } {
        const draft = this.snapshot().draft;
        this.listening = false;
        this.interim = "";
        // Fold everything recognized so far into base so the text survives.
        const committed = composeLiveDraft(this.base, this.finalized, "");
        this.base = draft;
        this.finalized = "";
        void committed;
        return { draft, listening: false };
    }

    get draft(): string {
        return composeLiveDraft(this.base, this.finalized, this.interim);
    }

    get isListening(): boolean {
        return this.listening;
    }

    snapshot(): MirrorLiveDraftSnapshot {
        return {
            base: this.base,
            finalized: this.finalized,
            interim: this.interim,
            draft: this.draft,
            listening: this.listening,
        };
    }
}

/**
 * Live-STT failure policy: recording must NEVER start when the fallback is
 * disabled, even if recognition fails. When enabled, the caller may follow
 * the legacy error/fallback path.
 */
export function shouldStartRecordingOnLiveFailure(enableRecording: boolean): boolean {
    return enableRecording === true;
}

/**
 * Consecutive recognizer auto-ends (silence timeouts) with nothing heard
 * before the mic gives up on its own. Any recognized speech resets the
 * count, so normal pauses while dictating never close the mic — it stays
 * open until the user explicitly stops it.
 */
export const MAX_LIVE_EMPTY_RESTARTS = 2;

export function shouldKeepListeningAfterAutoEnd(args: {
    userStopped: boolean;
    emptyRestarts: number;
    maxEmpty?: number;
}): boolean {
    if (args.userStopped) return false;
    return args.emptyRestarts < (args.maxEmpty ?? MAX_LIVE_EMPTY_RESTARTS);
}
