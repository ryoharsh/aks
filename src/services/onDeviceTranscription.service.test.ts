import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    ON_DEVICE_FAILED,
    ON_DEVICE_UNAVAILABLE,
    OnDeviceTranscriptionError,
    speechLocaleForLanguage,
    startLiveDictation,
    type SpeechRecognitionModuleShape,
} from "./onDeviceTranscription.service";

type ResultPayload = { isFinal?: boolean; results?: Array<{ transcript?: unknown }> };
type ErrorPayload = { error?: unknown; message?: unknown };

function createFakeModule(overrides: Partial<SpeechRecognitionModuleShape> = {}) {
    const resultListeners = new Set<(payload: ResultPayload) => void>();
    const errorListeners = new Set<(payload: ErrorPayload) => void>();
    const endListeners = new Set<() => void>();
    const module: SpeechRecognitionModuleShape = {
        requestPermissionsAsync: async () => ({ granted: true }),
        isRecognitionAvailable: () => true,
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
        addListener: ((event: string, listener: (payload: never) => void) => {
            const set = event === "result" ? resultListeners : event === "error" ? errorListeners : endListeners;
            (set as Set<(payload: never) => void>).add(listener);
            return { remove: () => (set as Set<(payload: never) => void>).delete(listener) };
        }) as SpeechRecognitionModuleShape["addListener"],
        ...overrides,
    };
    return {
        module,
        started: module.start as ReturnType<typeof vi.fn>,
        stopped: module.stop as ReturnType<typeof vi.fn>,
        emitResult: (payload: ResultPayload) => [...resultListeners].forEach((listener) => listener(payload)),
        emitError: (payload: ErrorPayload) => [...errorListeners].forEach((listener) => listener(payload)),
        emitEnd: () => [...endListeners].forEach((listener) => listener()),
    };
}

beforeEach(() => {
    vi.stubGlobal("__DEV__", false);
});

describe("speechLocaleForLanguage", () => {
    it("maps every app language to a BCP-47 locale", () => {
        expect(speechLocaleForLanguage("en")).toBe("en-US");
        expect(speechLocaleForLanguage("hi")).toBe("hi-IN");
        expect(speechLocaleForLanguage("fr")).toBe("fr-FR");
        expect(speechLocaleForLanguage("es")).toBe("es-ES");
        expect(speechLocaleForLanguage("zh")).toBe("zh-CN");
        expect(speechLocaleForLanguage("ja")).toBe("ja-JP");
        expect(speechLocaleForLanguage("ko")).toBe("ko-KR");
        expect(speechLocaleForLanguage("ar")).toBe("ar-SA");
        expect(speechLocaleForLanguage("ur")).toBe("ur-PK");
    });
});

describe("startLiveDictation", () => {
    // Listeners attach after the async permission check, so let the service
    // reach the subscription point before emitting native events.
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    it("starts live on-device dictation and streams partials", async () => {
        const partials: string[] = [];
        const { module, emitResult, started } = createFakeModule();
        const session = await startLiveDictation(
            { lang: "hi-IN", onPartial: (text) => partials.push(text) },
            { loadModule: async () => module },
        );
        expect(started).toHaveBeenCalledWith({
            lang: "hi-IN",
            interimResults: true,
            requiresOnDeviceRecognition: true,
        });
        emitResult({ isFinal: false, results: [{ transcript: "Hel" }] });
        emitResult({ isFinal: false, results: [{ transcript: "Hello" }] });
        await flush();
        expect(partials).toEqual(["Hel", "Hello"]);

        emitResult({ isFinal: true, results: [{ transcript: "Hello Aks" }] });
        await expect(session.stop()).resolves.toBe("Hello Aks");
        session.dispose();
    });

    it("auto-finalizes when the recognizer ends on its own", async () => {
        let autoEnded = false;
        const { module, emitResult, emitEnd } = createFakeModule();
        const session = await startLiveDictation(
            { lang: "en-US", onAutoEnd: () => { autoEnded = true; } },
            { loadModule: async () => module },
        );
        emitResult({ isFinal: false, results: [{ transcript: "Hello" }] });
        emitEnd();
        expect(autoEnded).toBe(true);
        // stop() after auto-end resolves the captured transcript immediately.
        await expect(session.stop()).resolves.toBe("Hello");
        session.dispose();
    });

    it("retries once through OS network recognition when no offline pack exists", async () => {
        const download = vi.fn(async () => ({ status: "download_scheduled" }));
        const { module, emitResult, emitError, started } = createFakeModule({ androidTriggerOfflineModelDownload: download });
        const session = await startLiveDictation({ lang: "en-US" }, { loadModule: async () => module });
        await flush();
        emitError({ error: "service-not-allowed", message: "not yet downloaded" });
        await flush();
        expect(download).toHaveBeenCalledWith({ locale: "en-US" });
        expect(started).toHaveBeenNthCalledWith(2, {
            lang: "en-US",
            interimResults: true,
            requiresOnDeviceRecognition: false,
        });
        emitResult({ isFinal: true, results: [{ transcript: "Hello Aks" }] });
        await expect(session.stop()).resolves.toBe("Hello Aks");
        session.dispose();
    });

    it("does not retry for ordinary recognition errors", async () => {
        const { module, emitError, started } = createFakeModule();
        const session = await startLiveDictation({}, { loadModule: async () => module });
        await flush();
        emitError({ error: "audio-capture" });
        expect(started).toHaveBeenCalledTimes(1);
        session.dispose();
    });

    it("stop resolves null when nothing recognizable was said", async () => {
        const { module, emitEnd } = createFakeModule();
        const session = await startLiveDictation({}, { loadModule: async () => module });
        await flush();
        emitEnd();
        await expect(session.stop()).resolves.toBeNull();
        session.dispose();
    });

    it("stop waits briefly for the final result", async () => {
        const { module, emitResult, stopped } = createFakeModule();
        const session = await startLiveDictation({ stopTimeoutMs: 50 }, { loadModule: async () => module });
        const pending = session.stop();
        expect(stopped).toHaveBeenCalledOnce();
        emitResult({ isFinal: true, results: [{ transcript: "Late final" }] });
        await expect(pending).resolves.toBe("Late final");
        session.dispose();
    });

    it("fails cleanly without the native module (Expo Go, web)", async () => {
        await expect(startLiveDictation({}, { loadModule: async () => { throw new Error("no module"); } }))
            .rejects.toMatchObject({ code: ON_DEVICE_UNAVAILABLE });
    });

    it("fails when recognition is unavailable or permission denied", async () => {
        const { module } = createFakeModule({ isRecognitionAvailable: () => false });
        await expect(startLiveDictation({}, { loadModule: async () => module }))
            .rejects.toMatchObject({ code: ON_DEVICE_UNAVAILABLE });

        const denied = createFakeModule({ requestPermissionsAsync: async () => ({ granted: false }) });
        await expect(startLiveDictation({}, { loadModule: async () => denied.module }))
            .rejects.toMatchObject({ code: ON_DEVICE_UNAVAILABLE });
    });

    it("fails when start throws", async () => {
        const { module } = createFakeModule({ start: () => { throw new Error("busy"); } });
        await expect(startLiveDictation({}, { loadModule: async () => module }))
            .rejects.toMatchObject({ code: ON_DEVICE_FAILED });
        await expect(startLiveDictation({}, { loadModule: async () => module }))
            .rejects.toBeInstanceOf(OnDeviceTranscriptionError);
    });
});
