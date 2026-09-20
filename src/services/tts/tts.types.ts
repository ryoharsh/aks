export type TTSOutputFormat = "pcm16" | "opus" | "aac";

export type TTSConfig = {
    provider: string;
    voice: string | null;
    language: string | null;
    /** Playback rate multiplier. 1 is normal speed. */
    speed: number;
    /** Voice pitch multiplier. 1 is normal pitch. */
    pitch: number;
    /** Output volume from 0 (muted) to 1 (full). */
    volume: number;
    /** Preferred synthesized audio format; on-device providers ignore it. */
    outputFormat: TTSOutputFormat;
    /** Preferred sample rate in Hz; on-device providers ignore it. */
    sampleRate: number;
};

export const defaultTTSConfig: TTSConfig = {
    provider: "expo-speech",
    voice: null,
    language: null,
    speed: 1,
    pitch: 1,
    volume: 1,
    outputFormat: "pcm16",
    sampleRate: 24000,
};

export type TTSCapabilities = {
    /** True when the provider can synthesize a stream of deltas instead of whole utterances. */
    streaming: boolean;
    /** True when pause()/resume() actually suspend and continue playback. */
    pauseResume: boolean;
    /** True when stop() interrupts the current utterance immediately. */
    interruptible: boolean;
};

export type TTSUtteranceHandlers = {
    onStart?: () => void;
    onDone?: () => void;
    onStopped?: () => void;
    onError?: (error: Error) => void;
};

/**
 * Provider-neutral TTS backend. The UI and TTSService only ever talk to this
 * interface, so a server-side streaming voice can replace the on-device
 * adapter without touching call sites.
 */
export interface TTSProvider {
    readonly id: string;
    getCapabilities(): TTSCapabilities;
    configure(config: TTSConfig): void;
    /** Queue one utterance for playback; handlers fire as its lifecycle advances. */
    synthesize(text: string, handlers: TTSUtteranceHandlers): void;
    stop(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    isSpeaking(): Promise<boolean>;
}

export type TTSState = {
    speaking: boolean;
    error: string | null;
    supported: boolean;
};
