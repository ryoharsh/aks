import type { Language } from "@/localization/languages";

/**
 * On-device speech-to-text for voice reflections, used when server STT is
 * not configured (`TRANSCRIPTION_NOT_CONFIGURED`).
 *
 * The mic runs LIVE on-device dictation through the OS speech recognizer —
 * no audio file is recorded for transcription, no API keys, no accounts, no
 * third-party billing. Recognition requests `requiresOnDeviceRecognition`
 * so capable devices keep audio fully on-device; when the device reports no
 * offline pack (`service-not-allowed` / `language-not-supported`), one
 * retry goes through the OS network recognizer (still keyless) while the
 * pack download is queued for next time.
 *
 * The native module only exists in a development build; everywhere else
 * (Expo Go, web) every call fails cleanly with `ON_DEVICE_UNAVAILABLE` and
 * the caller shows the honest generic notice. The module is loaded lazily
 * so merely importing this service never crashes builds without it.
 */

export const ON_DEVICE_UNAVAILABLE = "ON_DEVICE_UNAVAILABLE";
export const ON_DEVICE_EMPTY = "ON_DEVICE_EMPTY";
export const ON_DEVICE_FAILED = "ON_DEVICE_FAILED";

export type OnDeviceTranscriptionErrorCode =
    | typeof ON_DEVICE_UNAVAILABLE
    | typeof ON_DEVICE_EMPTY
    | typeof ON_DEVICE_FAILED;

export class OnDeviceTranscriptionError extends Error {
    constructor(public readonly code: OnDeviceTranscriptionErrorCode) {
        super(code);
        this.name = "OnDeviceTranscriptionError";
    }
}

type ListenerHandle = { remove(): void };

type ResultPayload = {
    isFinal?: boolean;
    results?: Array<{ transcript?: unknown }>;
};

type ErrorPayload = {
    error?: unknown;
    message?: unknown;
};

/** Structural subset of ExpoSpeechRecognitionModule used here. */
export type SpeechRecognitionModuleShape = {
    requestPermissionsAsync(): Promise<{ granted: boolean }>;
    isRecognitionAvailable(): boolean;
    start(options: {
        lang?: string;
        interimResults?: boolean;
        requiresOnDeviceRecognition?: boolean;
    }): void;
    stop(): void;
    abort(): void;
    /** Android 13+: queues the offline pack download. Fire-and-forget. */
    androidTriggerOfflineModelDownload?(options: { locale: string }): Promise<unknown>;
    addListener(event: "result", listener: (payload: ResultPayload) => void): ListenerHandle;
    addListener(event: "error", listener: (payload: ErrorPayload) => void): ListenerHandle;
    addListener(event: "end" | "nomatch", listener: (payload: Record<string, never>) => void): ListenerHandle;
};

/** BCP-47 locale per app language for the OS recognizer. */
const speechLocales: Record<Language, string> = {
    en: "en-US",
    hi: "hi-IN",
    fr: "fr-FR",
    es: "es-ES",
    zh: "zh-CN",
    ja: "ja-JP",
    ko: "ko-KR",
    ar: "ar-SA",
    ur: "ur-PK",
};

export function speechLocaleForLanguage(language: Language): string {
    return speechLocales[language] ?? "en-US";
}

/** Native errors meaning "no offline pack" — worth one OS-network retry. */
const OFFLINE_PACK_MISSING = new Set(["service-not-allowed", "language-not-supported"]);

async function loadModule(): Promise<SpeechRecognitionModuleShape> {
    try {
        const loaded = await import("expo-speech-recognition") as {
            ExpoSpeechRecognitionModule?: SpeechRecognitionModuleShape;
        };
        if (!loaded.ExpoSpeechRecognitionModule?.start) throw new Error("missing native module");
        return loaded.ExpoSpeechRecognitionModule;
    } catch {
        throw new OnDeviceTranscriptionError(ON_DEVICE_UNAVAILABLE);
    }
}

export type TranscribeFileDeps = {
    loadModule?: () => Promise<SpeechRecognitionModuleShape>;
};

async function prepareModule(deps: TranscribeFileDeps): Promise<SpeechRecognitionModuleShape> {
    let module: SpeechRecognitionModuleShape;
    try {
        module = await (deps.loadModule ?? loadModule)();
        if (!module?.start) throw new Error("missing native module");
    } catch (error) {
        if (error instanceof OnDeviceTranscriptionError) throw error;
        throw new OnDeviceTranscriptionError(ON_DEVICE_UNAVAILABLE);
    }
    let permission: { granted: boolean };
    try {
        permission = await module.requestPermissionsAsync();
    } catch {
        throw new OnDeviceTranscriptionError(ON_DEVICE_UNAVAILABLE);
    }
    if (!permission.granted) throw new OnDeviceTranscriptionError(ON_DEVICE_UNAVAILABLE);
    if (!module.isRecognitionAvailable()) throw new OnDeviceTranscriptionError(ON_DEVICE_UNAVAILABLE);
    return module;
}

function triggerOfflineDownload(module: SpeechRecognitionModuleShape, lang: string): void {
    try {
        void module.androidTriggerOfflineModelDownload?.({ locale: lang })?.catch(() => undefined);
    } catch {
        // Download kick-off is best-effort; recognition proceeds regardless.
    }
}

export type LiveDictationOptions = {
    lang?: string;
    /** Grace period for the final transcript after stop(). Default 8000ms. */
    stopTimeoutMs?: number;
    onPartial?: (text: string) => void;
    /** Fired when the recognizer ends on its own (silence timeout). */
    onAutoEnd?: () => void;
};

export type LiveDictationSession = {
    /** Resolve the final transcript (null when nothing recognizable). Never rejects. */
    stop: () => Promise<string | null>;
    /** Abort immediately and release listeners. */
    dispose: () => void;
};

/**
 * Start live on-device dictation on the microphone. Partial transcripts
 * stream through onPartial; stop() resolves the final transcript. The
 * recognizer may also end on its own (silence) — onAutoEnd fires so the UI
 * can flip to the review state. Never rejects after creation: failures
 * surface as a null transcript or onAutoEnd.
 */
export async function startLiveDictation(
    options: LiveDictationOptions = {},
    deps: TranscribeFileDeps = {},
): Promise<LiveDictationSession> {
    const module = await prepareModule(deps);
    const lang = options.lang ?? "en-US";
    const stopTimeoutMs = options.stopTimeoutMs ?? 8000;

    let latest = "";
    let lastWasFinal = false;
    let active = true;
    let stopping = false;
    let triedNetwork = false;
    let finished = false;
    let resolveStop: ((text: string | null) => void) | null = null;
    const handles: ListenerHandle[] = [];

    const cleanup = () => {
        for (const handle of handles.splice(0)) {
            try { handle.remove(); } catch { /* teardown is best-effort */ }
        }
    };

    const finish = (text: string | null) => {
        if (finished) return;
        finished = true;
        active = false;
        cleanup();
        const resolve = resolveStop;
        resolveStop = null;
        resolve?.(text);
    };

    const startWith = (onDevice: boolean) => {
        module.start({ lang, interimResults: true, requiresOnDeviceRecognition: onDevice });
    };

    const noteResult = (text: string, isFinal: boolean) => {
        if (!text || !active) return;
        latest = text;
        lastWasFinal = isFinal;
        if (isFinal) {
            if (stopping) finish(latest.trim() || null);
        } else if (!stopping) {
            options.onPartial?.(text);
        }
    };

    const noteError = (nativeError: string) => {
        if (__DEV__) console.warn("[on-device-transcription] native error:", { nativeError });
        if (finished || stopping) {
            if (stopping) finish(latest.trim() || null);
            return;
        }
        // No offline pack: queue its download and retry once through the OS
        // network recognizer (still keyless). Anything else keeps listening
        // until stop() — transient errors must not kill dictation early.
        if (!triedNetwork && OFFLINE_PACK_MISSING.has(nativeError)) {
            triedNetwork = true;
            triggerOfflineDownload(module, lang);
            if (__DEV__) console.warn("[on-device-transcription] no offline pack, retrying with OS network recognition");
            try {
                startWith(false);
            } catch {
                finish(null);
            }
        }
    };

    const noteEnd = () => {
        if (finished) return;
        if (stopping) {
            finish(latest.trim() || null);
            return;
        }
        // The recognizer ended on its own (e.g. silence timeout): hand the
        // transcript over as if the user had pressed stop.
        const text = latest.trim() || null;
        finish(text);
        options.onAutoEnd?.();
    };

    handles.push(module.addListener("result", (event) => {
        const text = typeof event.results?.[0]?.transcript === "string"
            ? (event.results[0].transcript as string).trim()
            : "";
        noteResult(text, event.isFinal === true);
    }));
    handles.push(module.addListener("error", (event) => {
        noteError(typeof event.error === "string" ? event.error : "unknown");
    }));
    handles.push(module.addListener("nomatch", noteEnd));
    handles.push(module.addListener("end", noteEnd));

    try {
        startWith(true);
    } catch {
        cleanup();
        throw new OnDeviceTranscriptionError(ON_DEVICE_FAILED);
    }

    return {
        stop: () => {
            if (finished) return Promise.resolve(latest.trim() || null);
            // A final already in hand with nothing partial after it: resolve
            // at once instead of waiting for another final that may not come.
            if (lastWasFinal) {
                const text = latest.trim() || null;
                finish(text);
                return Promise.resolve(text);
            }
            stopping = true;
            try {
                module.stop();
            } catch {
                finish(latest.trim() || null);
                return Promise.resolve(latest.trim() || null);
            }
            return new Promise<string | null>((resolve) => {
                resolveStop = resolve;
                setTimeout(() => {
                    if (resolveStop === resolve) finish(latest.trim() || null);
                }, stopTimeoutMs);
            });
        },
        dispose: () => {
            try { module.abort(); } catch { /* already finished */ }
            finish(null);
        },
    };
}
