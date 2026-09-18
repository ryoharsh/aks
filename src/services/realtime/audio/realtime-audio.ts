import type { RealtimeAudioHardware, RealtimeAudioSupport } from "../types";
import { MirrorRealtimeError, realTimeErrorMessage } from "../types";

export const REALTIME_AUDIO_NATIVE_MODULE = "AksRealtimeAudio";

export type AksRealtimeAudioNativeModule = {
    isSupported?: boolean;
    startCapture(sampleRate: number): void;
    stopCapture(): void;
    startPlayback(sampleRate: number): void;
    enqueuePcm(base64: string, sampleRate: number): void;
    flushPlayback(): void;
    stopPlayback(): void;
    interruptPlayback(): void;
};

const UNAVAILABLE_REASON =
    "AksRealtimeAudio is not bundled in this build. Live PCM microphone capture and streaming playback require a development build that registers the AksRealtimeAudio native module.";

function unsupportedHardware(reason: string): RealtimeAudioHardware {
    const reject = () =>
        Promise.reject(new MirrorRealtimeError("REALTIME_AUDIO_UNAVAILABLE", false, realTimeErrorMessage("REALTIME_AUDIO_UNAVAILABLE")));
    return {
        support: { supported: false, engine: "none", reason },
        requestMicPermission: async () => "denied",
        startCapture: () => reject(),
        stopCapture: () => reject(),
        startPlayback: () => reject(),
        enqueuePcm: () => {
            throw new MirrorRealtimeError("REALTIME_AUDIO_UNAVAILABLE", false, realTimeErrorMessage("REALTIME_AUDIO_UNAVAILABLE"));
        },
        flushPlayback: () => reject(),
        stopPlayback: () => reject(),
        interruptPlayback: () => undefined,
        cleanup: () => undefined,
    };
}

function nativeHardware(module: AksRealtimeAudioNativeModule): RealtimeAudioHardware {
    let captureRunning = false;
    let playbackRunning = false;
    let onFrame: ((pcmBase64: string) => void) | null = null;
    let onCaptureError: ((error: Error) => void) | null = null;

    return {
        support: { supported: true, engine: "native" },
        async requestMicPermission() {
            const expoAudio = await import("expo-audio");
            const permission = await expoAudio.AudioModule.requestRecordingPermissionsAsync();
            return permission.granted ? "granted" : "denied";
        },
        async startCapture(sampleRate, frame, onError) {
            if (captureRunning) return;
            onFrame = frame;
            onCaptureError = onError;
            module.startCapture(sampleRate);
            captureRunning = true;
        },
        async stopCapture() {
            if (!captureRunning) return;
            module.stopCapture();
            captureRunning = false;
            onFrame = null;
            onCaptureError = null;
        },
        async startPlayback(sampleRate) {
            if (playbackRunning) return;
            module.startPlayback(sampleRate);
            playbackRunning = true;
        },
        enqueuePcm(pcmBase64, sampleRate = 24000) {
            if (!playbackRunning) return;
            module.enqueuePcm(pcmBase64, sampleRate);
        },
        async flushPlayback() {
            if (!playbackRunning) return;
            module.flushPlayback();
        },
        async stopPlayback() {
            if (!playbackRunning) return;
            module.stopPlayback();
            playbackRunning = false;
        },
        interruptPlayback() {
            if (playbackRunning) module.interruptPlayback();
        },
        cleanup() {
            try {
                if (captureRunning) module.stopCapture();
                if (playbackRunning) module.stopPlayback();
            } catch {
                // The native module may already be gone.
            }
            captureRunning = false;
            playbackRunning = false;
            onFrame = null;
            onCaptureError = null;
        },
    };
}

let cachedHardware: Promise<RealtimeAudioHardware> | null = null;

/**
 * Resolves the audio hardware. The AksRealtimeAudio native module (registered
 * by a development build) provides live PCM capture and streaming playback;
 * without it every voice session fails cleanly instead of pretending to work.
 */
export function getRealtimeAudioHardware(): Promise<RealtimeAudioHardware> {
    if (cachedHardware) return cachedHardware;
    cachedHardware = (async () => {
        try {
            const { requireOptionalNativeModule } = await import("expo-modules-core");
            const nativeModule = requireOptionalNativeModule(REALTIME_AUDIO_NATIVE_MODULE) as AksRealtimeAudioNativeModule | null;
            return nativeModule ? nativeHardware(nativeModule) : unsupportedHardware(UNAVAILABLE_REASON);
        } catch {
            return unsupportedHardware(UNAVAILABLE_REASON);
        }
    })();
    return cachedHardware;
}

export function assertRealtimeAudioSupported(support: RealtimeAudioSupport): void {
    if (!support.supported) {
        throw new MirrorRealtimeError("REALTIME_AUDIO_UNAVAILABLE", false, realTimeErrorMessage("REALTIME_AUDIO_UNAVAILABLE"));
    }
}