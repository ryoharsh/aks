import type { TTSProvider } from "../tts.types";

/**
 * Client TTS adapter registry. Provider names resolve here — and only here —
 * so UI, hooks, and services never name a vendor. Selection comes from
 * TTSService config (default "expo-speech"); server-side selection can flow
 * through the same key without touching call sites. Unknown names fail
 * closed instead of silently falling back to a different voice.
 */
const loaders: Record<string, () => Promise<TTSProvider>> = {
    "expo-speech": async () => (await import("./expo-speech.provider")).createExpoSpeechProvider(),
};

export const TTS_PROVIDER_IDS = Object.keys(loaders);

export function createTTSProvider(name: string): Promise<TTSProvider> {
    const loader = loaders[name];
    if (!loader) return Promise.reject(new Error("TTS_PROVIDER_NOT_CONFIGURED"));
    return loader();
}
