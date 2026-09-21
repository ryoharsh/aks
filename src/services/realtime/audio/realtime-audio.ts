import type { RealtimeAudioHardware, RealtimeAudioSupport } from "../types";
import { MirrorRealtimeError, realTimeErrorMessage } from "../types";
import type { EventEmitter } from "expo-modules-core";

export const REALTIME_AUDIO_NATIVE_MODULE = "AksRealtimeAudio";

const isDev = typeof __DEV__ !== "undefined" && __DEV__;

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

/** Structural type for the Expo event emitter; avoids a static react-native import. */
type NativeModuleEvents = {
    onAudioFrame: (event: AudioFrameEvent) => void;
    onAudioError: (event: AudioErrorEvent) => void;
};

type AudioFrameEvent = { pcmBase64?: unknown };
type AudioErrorEvent = { message?: unknown };

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
    const supported = module.isSupported !== false;
    let captureRunning = false;
    let playbackRunning = false;
    let onFrame: ((pcmBase64: string) => void) | null = null;
    let onCaptureError: ((error: Error) => void) | null = null;
    let subscribed = false;
    let frameSubscription: { remove(): void } | null = null;
    let errorSubscription: { remove(): void } | null = null;

    // The module pushes PCM chunks as `onAudioFrame` events and failures as
    // `onAudioError`. Since Expo SDK 52 every native module already is an
    // event emitter, so we subscribe directly with a type-only import — zero
    // runtime cost, and unit tests never pay for react-native.
    function ensureEvents(): void {
        if (subscribed) return;
        subscribed = true;
        const emitter = module as unknown as InstanceType<EventEmitter<NativeModuleEvents>>;
        frameSubscription = emitter.addListener("onAudioFrame", (event) => {
            if (typeof event.pcmBase64 !== "string") return;
            try {
                onFrame?.(event.pcmBase64);
            } catch (error) {
                onCaptureError?.(error instanceof Error ? error : new Error("Audio capture failed."));
            }
        });
        errorSubscription = emitter.addListener("onAudioError", (event) => {
            const message = typeof event.message === "string" && event.message ? event.message : "Audio failed.";
            if (isDev) console.error("[AksRealtimeAudio] native audio error:", message);
            onCaptureError?.(new Error(message));
        });
    }

    return {
        support: supported
            ? { supported: true, engine: "native" }
            : { supported: false, engine: "none", reason: UNAVAILABLE_REASON },
        async requestMicPermission() {
            const expoAudio = await import("expo-audio");
            const permission = await expoAudio.AudioModule.requestRecordingPermissionsAsync();
            if (isDev) console.log("[AksRealtimeAudio] microphone permission:", permission.status, "granted:", permission.granted);
            return permission.granted ? "granted" : "denied";
        },
        async startCapture(sampleRate, frame, onError) {
            if (captureRunning) return;
            onFrame = frame;
            onCaptureError = onError;
            ensureEvents();
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
            try {
                frameSubscription?.remove();
                errorSubscription?.remove();
            } catch {
                // Unsubscribing is best-effort during teardown.
            }
            frameSubscription = null;
            errorSubscription = null;
            subscribed = false;
        },
    };
}

let cachedHardware: Promise<RealtimeAudioHardware> | null = null;

async function resolveRealtimeAudioHardware(): Promise<RealtimeAudioHardware> {
    let nativeModule: AksRealtimeAudioNativeModule | null = null;
    try {
        const { requireOptionalNativeModule } = await import("expo-modules-core");
        nativeModule = requireOptionalNativeModule(REALTIME_AUDIO_NATIVE_MODULE) as AksRealtimeAudioNativeModule | null;
    } catch {
        // expo-modules-core is unreachable in this runtime; report unsupported
        // without letting the probe settle on a permanent negative.
        cachedHardware = null;
        return unsupportedHardware(UNAVAILABLE_REASON);
    }
    if (!nativeModule || nativeModule.isSupported === false) {
        cachedHardware = null;
        return unsupportedHardware(UNAVAILABLE_REASON);
    }
    return nativeHardware(nativeModule);
}

/**
 * Resolves the audio hardware. The AksRealtimeAudio native module (registered
 * by a development build) provides live PCM capture and streaming playback;
 * without it every voice session fails cleanly instead of pretending to work.
 *
 * Only a positive resolution is cached: when the module is missing, the probe
 * re-runs on the next call so a development build that registers the module
 * mid-session is picked up without a full reload.
 */
export function getRealtimeAudioHardware(): Promise<RealtimeAudioHardware> {
    cachedHardware ??= resolveRealtimeAudioHardware();
    return cachedHardware;
}

export function clearRealtimeAudioHardwareCache(): void {
    cachedHardware = null;
}

export function assertRealtimeAudioSupported(support: RealtimeAudioSupport): void {
    if (!support.supported) {
        throw new MirrorRealtimeError("REALTIME_AUDIO_UNAVAILABLE", false, realTimeErrorMessage("REALTIME_AUDIO_UNAVAILABLE"));
    }
}

/**
 * Support probe with no side effects: resolves the hardware and reports
 * whether live listening is available, without requesting microphone
 * permission or starting capture. Use it to decide whether to auto-start
 * listening — never prompt for the mic on builds that cannot listen.
 */
export async function isLiveListeningSupported(): Promise<boolean> {
    try {
        const hardware = await getRealtimeAudioHardware();
        return hardware.support.supported;
    } catch {
        return false;
    }
}