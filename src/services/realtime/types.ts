export type RealtimeEvent =
    | { type: "sessionConnecting" }
    | { type: "sessionReady" }
    | { type: "listening" }
    | { type: "userSpeechStarted" }
    | { type: "userTranscriptDelta"; transcript: string }
    | { type: "userTranscriptFinal"; transcript: string }
    | { type: "thinking" }
    | { type: "assistantResponseStarted" }
    | { type: "assistantTextDelta"; text: string }
    | { type: "assistantTextFinal"; text: string }
    | { type: "assistantAudioStarted" }
    | { type: "assistantAudioChunk"; pcmBase64: string }
    | { type: "assistantAudioFinished" }
    | { type: "assistantInterrupted" }
    | { type: "turnCompleted" }
    | { type: "reconnecting"; attempt: number }
    | { type: "reconnected" }
    | { type: "error"; code: string; message: string; retryable: boolean }
    | { type: "sessionEnded" };

export const REAL_TIME_EVENT_TYPES = [
    "sessionConnecting",
    "sessionReady",
    "listening",
    "userSpeechStarted",
    "userTranscriptDelta",
    "userTranscriptFinal",
    "thinking",
    "assistantResponseStarted",
    "assistantTextDelta",
    "assistantTextFinal",
    "assistantAudioStarted",
    "assistantAudioChunk",
    "assistantAudioFinished",
    "assistantInterrupted",
    "turnCompleted",
    "reconnecting",
    "reconnected",
    "error",
    "sessionEnded",
] as const;

export type VoiceState =
    | "idle"
    | "connecting"
    | "connected"
    | "listening"
    | "userSpeaking"
    | "thinking"
    | "assistantSpeaking"
    | "interrupted"
    | "reconnecting"
    | "error"
    | "ending"
    | "ended";

export const realTimeErrorCodes = [
    "REALTIME_NOT_CONFIGURED",
    "REALTIME_SESSION_UNAVAILABLE",
    "REALTIME_TRANSPORT_UNAVAILABLE",
    "REALTIME_AUDIO_UNAVAILABLE",
    "REALTIME_MIC_PERMISSION_DENIED",
    "REALTIME_TRANSCRIPTION_FAILED",
    "REALTIME_PROVIDER_ERROR",
    "REALTIME_SESSION_EXPIRED",
    "REALTIME_SUBSCRIPTION_REQUIRED",
] as const;

export type RealtimeErrorCode = (typeof realTimeErrorCodes)[number];

export class MirrorRealtimeError extends Error {
    constructor(
        public readonly code: RealtimeErrorCode,
        public readonly retryable: boolean,
        message: string,
    ) {
        super(message);
        this.name = "MirrorRealtimeError";
    }
}

export function isMirrorRealtimeError(value: unknown): value is MirrorRealtimeError {
    return value instanceof MirrorRealtimeError;
}

export function realTimeErrorMessage(code: RealtimeErrorCode): string {
    switch (code) {
        case "REALTIME_NOT_CONFIGURED":
            return "Voice conversations aren’t configured for this build yet.";
        case "REALTIME_SESSION_UNAVAILABLE":
            return "We couldn’t start a voice session. Please try again.";
        case "REALTIME_TRANSPORT_UNAVAILABLE":
            return "This conversation option needs a development build of Aks.";
        case "REALTIME_AUDIO_UNAVAILABLE":
            return "Live voice needs a development build with the Aks audio engine.";
        case "REALTIME_MIC_PERMISSION_DENIED":
            return "Microphone access is needed for a voice conversation.";
        case "REALTIME_TRANSCRIPTION_FAILED":
            return "Aks couldn’t make out what you said. Please try again.";
        case "REALTIME_PROVIDER_ERROR":
            return "Aks couldn’t start the voice conversation right now.";
        case "REALTIME_SESSION_EXPIRED":
            return "The voice conversation expired. Reconnect to continue.";
        case "REALTIME_SUBSCRIPTION_REQUIRED":
            return "An active Aks subscription is required.";
    }
}

export type RealtimeTransportKind = "websocket" | "webrtc";

export type RealtimeSessionSpec = {
    conversationId: string | null;
    provider: string;
    protocol: string;
    transport: RealtimeTransportKind;
    endpoint: string;
    sessionToken: string;
    tokenExpiresAt: number | null;
    model: string;
    instructions: string;
    inputSampleRate: number;
    outputSampleRate: number;
    pcmFormat: "pcm16";
    /**
     * How the transport attaches the session token. Absent means the
     * Authorization Bearer header (OpenAI). Gemini ephemeral tokens use
     * `access_token` query placement.
     */
    auth?: { placement: "header" | "query"; param?: string };
    /**
     * Server-selected voice and transcription model (AI_TTS_MODEL /
     * AI_STT_MODEL). Absent on older specs — adapters fall back to the
     * protocol defaults, so the OpenAI flow is byte-identical either way.
     */
    voice?: string;
    transcriptionModel?: string;
};

export type RealtimeProtocolCommand =
    | { type: "sessionStart" }
    | { type: "userText"; text: string }
    | { type: "userAudioFrame"; pcmBase64: string }
    | { type: "commitInput" }
    | { type: "cancelResponse" };

export interface RealtimeSessionProtocol {
    readonly id: string;
    parse(raw: unknown): RealtimeEvent[];
    build(command: RealtimeProtocolCommand): unknown[];
}

export type RealtimeTransportCloseInfo = {
    code: number;
    reason: string;
    wasClean: boolean;
};

export interface RealtimeTransport {
    readonly kind: RealtimeTransportKind;
    connect(spec: RealtimeSessionSpec): Promise<void>;
    send(payload: unknown): void;
    close(): Promise<void>;
    onMessage(listener: (raw: unknown) => void): () => void;
    onClose(listener: (info: RealtimeTransportCloseInfo) => void): () => void;
    onError(listener: (error: Error) => void): () => void;
}

export type RealtimeAudioEngine = "native" | "none";

export type RealtimeAudioSupport = {
    supported: boolean;
    engine: RealtimeAudioEngine;
    reason?: string;
};

export interface RealtimeAudioHardware {
    readonly support: RealtimeAudioSupport;
    requestMicPermission(): Promise<"granted" | "denied">;
    startCapture(sampleRate: number, onFrame: (pcmBase64: string) => void, onError: (error: Error) => void): Promise<void>;
    stopCapture(): Promise<void>;
    startPlayback(sampleRate: number): Promise<void>;
    enqueuePcm(pcmBase64: string, sampleRate?: number): void;
    flushPlayback(): Promise<void>;
    stopPlayback(): Promise<void>;
    interruptPlayback(): void;
    cleanup(): void;
}

export type RealtimeSessionRequest = {
    conversationId: string | null;
};

export interface RealtimeProviderAdapter {
    createSession(request: RealtimeSessionRequest): Promise<RealtimeSessionSpec>;
}

export interface RealtimeConversationSession {
    subscribe(listener: (event: RealtimeEvent) => void): () => void;
    readonly active: boolean;
    start(): Promise<void>;
    interrupt(): void;
    stop(): Promise<void>;
    dispose(): void;
    setAssistantAudioEnabled?(enabled: boolean): void;
}