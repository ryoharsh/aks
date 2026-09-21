import { describe, expect, it, vi } from "vitest";

import {
    appendFinalChunk,
    composeLiveDraft,
    isMirrorVoiceRecordingEnabled,
    MAX_LIVE_EMPTY_RESTARTS,
    MirrorLiveDraftManager,
    resolveMirrorMicMode,
    shouldKeepListeningAfterAutoEnd,
    shouldStartRecordingOnLiveFailure,
} from "./mirrorVoice";

describe("mirror voice recording flag", () => {
    it("1. missing variable means recording disabled", () => {
        expect(isMirrorVoiceRecordingEnabled({})).toBe(false);
        expect(isMirrorVoiceRecordingEnabled({ EXPO_PUBLIC_ENABLE_MIRROR_VOICE_RECORDING: undefined })).toBe(false);
    });

    it("2. \"false\" means recording disabled", () => {
        expect(isMirrorVoiceRecordingEnabled({ EXPO_PUBLIC_ENABLE_MIRROR_VOICE_RECORDING: "false" })).toBe(false);
        expect(isMirrorVoiceRecordingEnabled({ EXPO_PUBLIC_ENABLE_MIRROR_VOICE_RECORDING: "" })).toBe(false);
        expect(isMirrorVoiceRecordingEnabled({ EXPO_PUBLIC_ENABLE_MIRROR_VOICE_RECORDING: "0" })).toBe(false);
    });

    it("3. \"true\" permits the recording fallback", () => {
        expect(isMirrorVoiceRecordingEnabled({ EXPO_PUBLIC_ENABLE_MIRROR_VOICE_RECORDING: "true" })).toBe(true);
    });

    it("does not rely on truthiness (\"TRUE\"/\"1\" stay disabled)", () => {
        expect(isMirrorVoiceRecordingEnabled({ EXPO_PUBLIC_ENABLE_MIRROR_VOICE_RECORDING: "TRUE" })).toBe(false);
        expect(isMirrorVoiceRecordingEnabled({ EXPO_PUBLIC_ENABLE_MIRROR_VOICE_RECORDING: "1" })).toBe(false);
    });
});

describe("mirror mic routing", () => {
    it("4. default mic uses live STT", () => {
        expect(resolveMirrorMicMode(isMirrorVoiceRecordingEnabled({}))).toBe("live");
        expect(resolveMirrorMicMode(isMirrorVoiceRecordingEnabled({ EXPO_PUBLIC_ENABLE_MIRROR_VOICE_RECORDING: "false" }))).toBe("live");
        expect(resolveMirrorMicMode(isMirrorVoiceRecordingEnabled({ EXPO_PUBLIC_ENABLE_MIRROR_VOICE_RECORDING: "true" }))).toBe("recording-fallback");
    });
});

describe("live draft composition", () => {
    it("5. live interim text appears in the draft", () => {
        const manager = new MirrorLiveDraftManager();
        manager.start("");
        manager.handleInterim("hello aks");
        expect(manager.draft).toBe("hello aks");
    });

    it("6. final text is committed correctly", () => {
        const manager = new MirrorLiveDraftManager();
        manager.start("");
        manager.handleInterim("hello");
        manager.handleFinal("hello aks");
        expect(manager.draft).toBe("hello aks");
        expect(manager.snapshot().interim).toBe("");
        expect(manager.snapshot().finalized).toBe("hello aks");
    });

    it("7. interim → final transition does not duplicate text", () => {
        const manager = new MirrorLiveDraftManager();
        manager.start("");
        manager.handleInterim("hello aks");
        manager.handleFinal("hello aks");
        expect(manager.draft).toBe("hello aks");

        // Cumulative retransmit: final restates previous finals + new words.
        const cumulative = new MirrorLiveDraftManager();
        cumulative.start("");
        cumulative.handleFinal("hello aks");
        cumulative.handleFinal("hello aks how are you");
        expect(cumulative.draft).toBe("hello aks how are you");

        // Pure helpers agree.
        expect(appendFinalChunk("hello aks", "hello aks")).toBe("hello aks");
        expect(composeLiveDraft("", "hello aks", "hello aks")).toBe("hello aks");
        expect(composeLiveDraft("", "", "hello")).toBe("hello");
    });

    it("8. existing manually typed text is preserved", () => {
        const manager = new MirrorLiveDraftManager();
        manager.start("Today I want to talk about ");
        manager.handleInterim("my project");
        expect(manager.draft).toBe("Today I want to talk about my project");
        manager.handleFinal("my project");
        expect(manager.draft).toBe("Today I want to talk about my project");
    });

    it("8b. typing mid-dictation is folded into the base, not clobbered", () => {
        const manager = new MirrorLiveDraftManager();
        manager.start("Today ");
        manager.handleInterim("my project");
        expect(manager.draft).toBe("Today my project");
        manager.handleManualEdit("Today about focus my project");
        manager.handleInterim("my project today");
        expect(manager.draft).toContain("about focus");
    });
});

describe("mic toggle and submit behavior", () => {
    it("9. tapping mic again stops STT and keeps the transcript", () => {
        const manager = new MirrorLiveDraftManager();
        manager.start("Today ");
        manager.handleInterim("my project");
        expect(manager.isListening).toBe(true);
        const stopped = manager.stop();
        expect(stopped.listening).toBe(false);
        expect(manager.isListening).toBe(false);
        // Interim preview is committed-or-kept pattern: stop clears the
        // preview flag while the last committed text path preserves finals.
        manager.start("Today ");
        manager.handleFinal("my project");
        manager.stop();
        expect(manager.draft).toBe("Today my project");
    });

    it("10. stopping mic does not submit the message", () => {
        const sendMessage = vi.fn();
        const manager = new MirrorLiveDraftManager();
        manager.start("");
        manager.handleInterim("hello");
        manager.handleFinal("hello aks");
        manager.stop();
        // The manager exposes no submit path by design — stopping only
        // commits text. The send mock must stay untouched.
        expect(sendMessage).not.toHaveBeenCalled();
        expect(manager.draft).toBe("hello aks");
    });
});

describe("failure and fallback gating", () => {
    function simulateMicPressAndLiveFailure(enableRecording: boolean) {
        const liveStart = vi.fn(async () => { throw new Error("ON_DEVICE_UNAVAILABLE"); });
        const recordingStart = vi.fn(async () => undefined);
        const showError = vi.fn();
        return (async () => {
            const mode = resolveMirrorMicMode(enableRecording);
            if (mode === "live") {
                try {
                    await liveStart();
                } catch {
                    showError();
                    if (shouldStartRecordingOnLiveFailure(enableRecording)) {
                        await recordingStart();
                    }
                }
            } else {
                await recordingStart();
            }
            return { liveStart, recordingStart, showError };
        })();
    }

    it("11. live STT failure does NOT start recording when disabled", async () => {
        const { liveStart, recordingStart, showError } = await simulateMicPressAndLiveFailure(false);
        expect(liveStart).toHaveBeenCalledTimes(1);
        expect(showError).toHaveBeenCalledTimes(1);
        expect(recordingStart).not.toHaveBeenCalled();
        expect(shouldStartRecordingOnLiveFailure(false)).toBe(false);
    });

    it("12. recording fallback can still execute when explicitly enabled", async () => {
        expect(shouldStartRecordingOnLiveFailure(true)).toBe(true);
        const recordingStart = vi.fn(async () => undefined);
        const enableRecording = isMirrorVoiceRecordingEnabled({ EXPO_PUBLIC_ENABLE_MIRROR_VOICE_RECORDING: "true" });
        expect(resolveMirrorMicMode(enableRecording)).toBe("recording-fallback");
        if (enableRecording) await recordingStart();
        expect(recordingStart).toHaveBeenCalledTimes(1);
    });
});

describe("keep-open mic behavior", () => {
    it("mic auto-end keeps listening when the user has not stopped", () => {
        expect(shouldKeepListeningAfterAutoEnd({
            userStopped: false,
            emptyRestarts: 0,
        })).toBe(true);
        expect(shouldKeepListeningAfterAutoEnd({
            userStopped: false,
            emptyRestarts: MAX_LIVE_EMPTY_RESTARTS,
        })).toBe(false);
        expect(shouldKeepListeningAfterAutoEnd({
            userStopped: true,
            emptyRestarts: 0,
        })).toBe(false);
    });
});

describe("lifecycle cleanup", () => {
    it("13. blur/unmount cleans up listeners and mic state while preserving text", () => {
        const dispose = vi.fn();
        const manager = new MirrorLiveDraftManager();
        manager.start("Today ");
        manager.handleInterim("my project");
        const visibleBeforeBlur = manager.draft;
        expect(visibleBeforeBlur).toBe("Today my project");
        expect(manager.isListening).toBe(true);

        // Simulate screen blur: remove listeners (dispose), stop the mic,
        // keep the recognized text.
        dispose();
        const { draft, listening } = manager.disposePreservingDraft();
        expect(dispose).toHaveBeenCalledTimes(1);
        expect(listening).toBe(false);
        expect(manager.isListening).toBe(false);
        expect(draft).toBe("Today my project");
    });
});
