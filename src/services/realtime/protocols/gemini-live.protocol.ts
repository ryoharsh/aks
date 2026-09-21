import type { RealtimeEvent, RealtimeProtocolCommand, RealtimeSessionProtocol, RealtimeSessionSpec } from "../types";
import { MirrorRealtimeError } from "../types";

type WireMessage = { [key: string]: unknown };

function isWireMessage(value: unknown): value is WireMessage {
    return Boolean(value) && typeof value === "object";
}

function asText(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Maps the Gemini Live (BidiGenerateContent) wire dialect to the normalized
 * Aks Realtime event contract — the same RealtimeEvent union the OpenAI
 * protocol speaks, so the session service, useMirror, and the UI behave
 * identically no matter which provider minted the session.
 *
 * All Gemini-specific details (setup payload, realtimeInput frames,
 * serverContent shapes) stay inside this file. Gemin Live owns STT + voice
 * end to end, so no separate transcription/voice configuration is consulted:
 * audio + text arrive together inside `serverContent.modelTurn` parts.
 */
export class GeminiLiveProtocol implements RealtimeSessionProtocol {
    readonly id = "gemini-live";

    private responseInFlight = false;
    private audioStartedForResponse = false;
    private speechAnnouncedForTurn = false;

    constructor(private readonly spec: RealtimeSessionSpec) {}

    reset() {
        this.responseInFlight = false;
        this.audioStartedForResponse = false;
        this.speechAnnouncedForTurn = false;
    }

    build(command: RealtimeProtocolCommand): unknown[] {
        switch (command.type) {
            case "sessionStart":
                return [{
                    setup: {
                        // The Live endpoint is model-scoped by this setup
                        // message (the websocket URL carries no model).
                        model: this.spec.model,
                        generationConfig: { responseModalities: ["AUDIO", "TEXT"] },
                        systemInstruction: { parts: [{ text: this.spec.instructions }] },
                        inputAudioTranscription: {},
                        outputAudioTranscription: {},
                    },
                }];
            case "userText":
                return [{
                    clientContent: {
                        turns: [{ role: "user", parts: [{ text: command.text }] }],
                        turnComplete: true,
                    },
                }];
            case "userAudioFrame":
                return [{
                    realtimeInput: {
                        audio: { mimeType: `audio/pcm;rate=${this.spec.inputSampleRate}`, data: command.pcmBase64 },
                    },
                }];
            case "commitInput":
                return [{ realtimeInput: { audioStreamEnd: true } }];
            case "cancelResponse":
                // The Live API has no server-side cancel: barge-in is handled
                // client-side (the session service stops local playback and
                // emits `assistantInterrupted`), while the model observes the
                // fresh input audio and self-interrupts. Nothing to send.
                return [];
        }
    }

    parse(raw: unknown): RealtimeEvent[] {
        if (!isWireMessage(raw)) return [];
        if (raw.setupComplete !== undefined) {
            this.responseInFlight = false;
            this.audioStartedForResponse = false;
            this.speechAnnouncedForTurn = false;
            return [{ type: "sessionReady" }, { type: "listening" }];
        }
        const serverContent = raw.serverContent;
        if (!isWireMessage(serverContent)) {
            if (raw.error !== undefined) return [this.mapError(raw.error)];
            return [];
        }

        const inputTranscription = serverContent.inputTranscription;
        if (isWireMessage(inputTranscription)) {
            const text = asText(inputTranscription.text);
            if (!text) return [];
            const events: RealtimeEvent[] = [];
            if (!this.speechAnnouncedForTurn) {
                this.speechAnnouncedForTurn = true;
                events.push({ type: "userSpeechStarted" });
            }
            if (inputTranscription.isFinal === true) {
                events.push({ type: "userTranscriptFinal", transcript: text });
                // The live model is now working on the reply.
                events.push({ type: "thinking" });
            } else {
                events.push({ type: "userTranscriptDelta", transcript: text });
            }
            return events;
        }

        if (serverContent.interrupted === true) {
            this.responseInFlight = false;
            this.audioStartedForResponse = false;
            return [{ type: "assistantInterrupted" }];
        }

        if (serverContent.turnComplete === true) {
            const events: RealtimeEvent[] = [];
            if (this.audioStartedForResponse) events.push({ type: "assistantAudioFinished" });
            events.push({ type: "assistantTextFinal", text: "" });
            events.push({ type: "turnCompleted" });
            this.responseInFlight = false;
            this.audioStartedForResponse = false;
            this.speechAnnouncedForTurn = false;
            return events;
        }

        const outputTranscription = serverContent.outputTranscription;
        if (isWireMessage(outputTranscription)) {
            const text = asText(outputTranscription.text);
            if (!text) return [];
            const events: RealtimeEvent[] = [];
            if (!this.responseInFlight) {
                this.responseInFlight = true;
                events.push({ type: "assistantResponseStarted" });
            }
            if (outputTranscription.isFinal === true) {
                events.push({ type: "assistantTextFinal", text: "" });
            } else {
                events.push({ type: "assistantTextDelta", text });
            }
            return events;
        }

        const modelTurn = serverContent.modelTurn;
        if (isWireMessage(modelTurn) && Array.isArray(modelTurn.parts)) {
            const events: RealtimeEvent[] = [];
            for (const part of modelTurn.parts) {
                if (!isWireMessage(part)) continue;
                const text = asText(part.text);
                if (text) {
                    if (!this.responseInFlight) {
                        this.responseInFlight = true;
                        events.push({ type: "assistantResponseStarted" });
                    }
                    events.push({ type: "assistantTextDelta", text });
                    continue;
                }
                const inlineData = part.inlineData;
                const audio = isWireMessage(inlineData) ? asText(inlineData.data) : null;
                if (audio) {
                    if (!this.responseInFlight) {
                        this.responseInFlight = true;
                        events.push({ type: "assistantResponseStarted" });
                    }
                    if (!this.audioStartedForResponse) {
                        this.audioStartedForResponse = true;
                        events.push({ type: "assistantAudioStarted" });
                    }
                    events.push({ type: "assistantAudioChunk", pcmBase64: audio });
                }
            }
            return events;
        }

        return [];
    }

    private mapError(wire: unknown): RealtimeEvent {
        const message = isWireMessage(wire) && typeof wire.message === "string" && wire.message
            ? wire.message
            : "The voice conversation failed.";
        const code = isWireMessage(wire) ? String(wire.code ?? "") : "";
        if (code === "session_expired") {
            return { type: "error", code: "REALTIME_SESSION_EXPIRED", message: "The voice conversation expired.", retryable: true };
        }
        return { type: "error", code: "REALTIME_PROVIDER_ERROR", message, retryable: code !== "invalid_request_error" };
    }
}

export function assertGeminiSessionCompatible(spec: RealtimeSessionSpec): void {
    if (spec.protocol !== "gemini-live") {
        throw new MirrorRealtimeError("REALTIME_TRANSPORT_UNAVAILABLE", false, `The Gemini adapter cannot serve protocol "${spec.protocol}".`);
    }
    if (spec.pcmFormat !== "pcm16") {
        throw new MirrorRealtimeError("REALTIME_TRANSPORT_UNAVAILABLE", false, "This provider only supports pcm16 audio.");
    }
}
