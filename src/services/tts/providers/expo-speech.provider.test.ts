import { describe, expect, it, vi } from "vitest";

import { createExpoSpeechProvider } from "./expo-speech.provider";

const mocks = vi.hoisted(() => {
    const speech = {
        speak: vi.fn(),
        stop: vi.fn(async () => undefined),
        pause: vi.fn(async () => undefined),
        resume: vi.fn(async () => undefined),
        isSpeakingAsync: vi.fn(async () => false),
    };
    const platform = { OS: "ios" };
    return { speech, platform };
});

vi.mock("expo-speech", () => ({ ...mocks.speech }));
vi.mock("react-native", () => ({ Platform: mocks.platform }));

describe("createExpoSpeechProvider", () => {
    it("maps config into Speech.speak options with clamps and wires lifecycle callbacks", () => {
        const provider = createExpoSpeechProvider();
        const handlers = { onStart: vi.fn(), onDone: vi.fn(), onStopped: vi.fn(), onError: vi.fn() };
        provider.configure({
            provider: "expo-speech",
            voice: "voice-1",
            language: "en-US",
            speed: 3,
            pitch: 0.1,
            volume: 2,
            outputFormat: "pcm16",
            sampleRate: 24000,
        });
        provider.synthesize("Hello there.", handlers);

        expect(mocks.speech.speak).toHaveBeenCalledWith(
            "Hello there.",
            expect.objectContaining({ voice: "voice-1", language: "en-US", rate: 2, pitch: 0.5, volume: 1 }),
        );
        const options = mocks.speech.speak.mock.calls[0][1];
        options.onStart();
        options.onDone();
        options.onStopped();
        options.onError(new Error("boom"));
        expect(handlers.onStart).toHaveBeenCalled();
        expect(handlers.onDone).toHaveBeenCalled();
        expect(handlers.onStopped).toHaveBeenCalled();
        expect(handlers.onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("reports pause/resume capability on iOS and not on Android", async () => {
        mocks.platform.OS = "ios";
        const ios = createExpoSpeechProvider();
        expect(ios.getCapabilities().pauseResume).toBe(true);
        await ios.pause();
        expect(mocks.speech.pause).toHaveBeenCalled();

        mocks.speech.pause.mockClear();
        mocks.platform.OS = "android";
        const android = createExpoSpeechProvider();
        expect(android.getCapabilities().pauseResume).toBe(false);
        await android.pause();
        await android.resume();
        expect(mocks.speech.pause).not.toHaveBeenCalled();
        expect(mocks.speech.resume).not.toHaveBeenCalled();
    });

    it("does not stream and delegates stop/isSpeaking to the engine", async () => {
        mocks.platform.OS = "ios";
        const provider = createExpoSpeechProvider();
        expect(provider.getCapabilities().streaming).toBe(false);
        await provider.stop();
        expect(mocks.speech.stop).toHaveBeenCalled();
        mocks.speech.isSpeakingAsync.mockResolvedValueOnce(true);
        expect(await provider.isSpeaking()).toBe(true);
    });
});
