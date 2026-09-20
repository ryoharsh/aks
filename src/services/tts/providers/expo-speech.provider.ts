import { Platform } from "react-native";
import * as Speech from "expo-speech";

import { defaultTTSConfig, type TTSCapabilities, type TTSConfig, type TTSProvider, type TTSUtteranceHandlers } from "../tts.types";

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

/**
 * On-device TTS via expo-speech. No provider keys ship in the bundle and no
 * audio is persisted — synthesis happens entirely in the OS speech engine.
 * pause()/resume() are iOS/web-only in expo-speech, so capabilities say so.
 */
export function createExpoSpeechProvider(): TTSProvider {
    let config: TTSConfig = { ...defaultTTSConfig };

    return {
        id: "expo-speech",
        getCapabilities(): TTSCapabilities {
            return {
                streaming: false,
                pauseResume: Platform.OS !== "android",
                interruptible: true,
            };
        },
        configure(next: TTSConfig) {
            config = { ...config, ...next };
        },
        synthesize(text: string, handlers: TTSUtteranceHandlers) {
            Speech.speak(text, {
                language: config.language ?? undefined,
                voice: config.voice ?? undefined,
                rate: clamp(config.speed, 0.25, 2),
                pitch: clamp(config.pitch, 0.5, 2),
                volume: clamp(config.volume, 0, 1),
                onStart: () => handlers.onStart?.(),
                onDone: () => handlers.onDone?.(),
                onStopped: () => handlers.onStopped?.(),
                onError: (error) => handlers.onError?.(error),
            });
        },
        stop() {
            return Speech.stop();
        },
        pause() {
            return Platform.OS === "android" ? Promise.resolve() : Speech.pause();
        },
        resume() {
            return Platform.OS === "android" ? Promise.resolve() : Speech.resume();
        },
        isSpeaking() {
            return Speech.isSpeakingAsync();
        },
    };
}
