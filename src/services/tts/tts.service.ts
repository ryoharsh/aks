import { defaultTTSConfig, type TTSConfig, type TTSProvider, type TTSState, type TTSUtteranceHandlers } from "./tts.types";

export const MIN_UTTERANCE_CHARS = 8;
export const MAX_UTTERANCE_CHARS = 180;

const SENTENCE_BOUNDARY = /[.!?…\n;]/;
const HARD_SPLIT_BOUNDARY = /[\s,—–-]/;

const ERROR_UNSUPPORTED = "Spoken replies aren’t available on this device.";
const ERROR_PLAYBACK = "Voice playback hit a snag. The reply is still on screen.";

type SplitResult = { chunks: string[]; remainder: string };

function hardSplitEmit(text: string, chunks: string[]) {
    let rest = text.trim();
    while (rest.length > MAX_UTTERANCE_CHARS) {
        let cut = -1;
        for (let i = MAX_UTTERANCE_CHARS; i > MIN_UTTERANCE_CHARS; i--) {
            if (HARD_SPLIT_BOUNDARY.test(rest[i])) {
                cut = i;
                break;
            }
        }
        if (cut <= 0) cut = MAX_UTTERANCE_CHARS;
        chunks.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
    }
    if (rest) chunks.push(rest);
}

/**
 * Splits streamed text into speakable utterances at sentence boundaries.
 * Fragments shorter than MIN_UTTERANCE_CHARS are held back (they may merge
 * with the next sentence) unless `flush` is set, which speaks everything —
 * a one-word final answer must still be heard. Runs past MAX_UTTERANCE_CHARS
 * without any punctuation are hard-split so a long sentence still streams.
 */
export function splitSpeakableText(input: string, options: { flush: boolean }): SplitResult {
    const segments: string[] = [];
    let start = 0;
    for (let i = 0; i < input.length; i++) {
        if (!SENTENCE_BOUNDARY.test(input[i])) continue;
        const next = input[i + 1];
        if (next !== undefined && !/\s/.test(next)) continue;
        const piece = input.slice(start, i + 1);
        if (piece.trim()) segments.push(piece);
        start = i + 1;
    }
    const trailing = input.slice(start);

    const chunks: string[] = [];
    let pending = "";
    for (const segment of segments) {
        pending += segment;
        if (pending.trim().length >= MIN_UTTERANCE_CHARS) {
            hardSplitEmit(pending, chunks);
            pending = "";
        }
    }

    const tail = pending + trailing;
    if (options.flush) {
        hardSplitEmit(tail, chunks);
        return { chunks, remainder: "" };
    }
    if (tail.length > MAX_UTTERANCE_CHARS) {
        let cut = -1;
        for (let i = MAX_UTTERANCE_CHARS; i > MIN_UTTERANCE_CHARS; i--) {
            if (HARD_SPLIT_BOUNDARY.test(tail[i])) {
                cut = i;
                break;
            }
        }
        if (cut <= 0) cut = MAX_UTTERANCE_CHARS;
        hardSplitEmit(tail.slice(0, cut), chunks);
        return { chunks, remainder: tail.slice(cut) };
    }
    return { chunks, remainder: tail };
}

type QueuedUtterance = {
    turnId: string;
    text: string;
    generation: number;
};

/**
 * Turn-aware TTS facade. Owns sentence chunking of streamed reply text, a
 * strictly FIFO playback queue (sentence two never plays before sentence
 * one), interruption, and stale-turn guards. TTS problems surface through
 * state.error — they never throw into the conversation flow.
 */
export class TTSService {
    private config: TTSConfig = { ...defaultTTSConfig };
    private provider: TTSProvider | null = null;
    private providerPromise: Promise<TTSProvider> | null = null;
    private queue: QueuedUtterance[] = [];
    private activeUtterance: QueuedUtterance | null = null;
    private currentResolve: (() => void) | null = null;
    private activeTurnId: string | null = null;
    private turnBuffer = "";
    private consumedLength = 0;
    private expiredTurns = new Set<string>();
    private generation = 0;
    private pumping = false;
    private state: TTSState = { speaking: false, error: null, supported: true };
    private listeners = new Set<(state: TTSState) => void>();

    configure(patch: Partial<TTSConfig>) {
        this.config = { ...this.config, ...patch };
        this.provider?.configure(this.config);
    }

    getConfig(): TTSConfig {
        return { ...this.config };
    }

    registerProvider(provider: TTSProvider) {
        this.provider = provider;
        provider.configure(this.config);
        this.emit();
    }

    subscribe(listener: (state: TTSState) => void): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    getState(): TTSState {
        return { ...this.state };
    }

    /** Feed accumulated reply text for a turn; completed sentences are queued as they appear. */
    updateTurn(turnId: string, accumulatedText: string) {
        if (this.expiredTurns.has(turnId)) return;
        if (this.activeTurnId !== turnId) {
            if (this.activeTurnId !== null) return;
            this.activeTurnId = turnId;
            this.turnBuffer = "";
            this.consumedLength = 0;
        }
        if (accumulatedText.length < this.consumedLength) return;
        this.turnBuffer = accumulatedText;
        this.drainCompleted(false);
    }

    /** Mark a turn final and speak whatever the sentence chunker was holding back. */
    endTurn(turnId: string, finalText: string) {
        if (this.activeTurnId !== turnId || this.expiredTurns.has(turnId)) return;
        if (finalText.length >= this.consumedLength) this.turnBuffer = finalText;
        this.drainCompleted(true);
        this.expireTurn(turnId);
        // Release the channel so the next turn can adopt it; queued utterances
        // from this turn keep playing (they carry their own turn + generation).
        this.activeTurnId = null;
        this.turnBuffer = "";
        this.consumedLength = 0;
    }

    /** One-shot helper for a complete reply that was never streamed. */
    speakTurn(turnId: string, text: string) {
        this.updateTurn(turnId, text);
        this.endTurn(turnId, text);
    }

    /** Interrupt playback. When a turnId is given, only that active turn is stopped. */
    stop(turnId?: string) {
        if (turnId && turnId !== this.activeTurnId && !this.queue.some((item) => item.turnId === turnId)) return;
        this.generation++;
        this.queue = [];
        if (this.activeTurnId) this.expireTurn(this.activeTurnId);
        this.activeTurnId = null;
        this.turnBuffer = "";
        this.consumedLength = 0;
        this.activeUtterance = null;
        void this.resolveProvider()
            .then((provider) => provider.stop())
            .catch(() => undefined);
        this.currentResolve?.();
        this.setState({ speaking: false });
    }

    async pause(): Promise<boolean> {
        const provider = this.provider;
        if (!provider || !provider.getCapabilities().pauseResume) return false;
        try {
            await provider.pause();
            return true;
        } catch {
            return false;
        }
    }

    async resume(): Promise<boolean> {
        const provider = this.provider;
        if (!provider || !provider.getCapabilities().pauseResume) return false;
        try {
            await provider.resume();
            return true;
        } catch {
            return false;
        }
    }

    async isSpeaking(): Promise<boolean> {
        if (this.queue.length > 0 || this.activeUtterance) return true;
        if (!this.provider) return this.state.speaking;
        try {
            return await this.provider.isSpeaking();
        } catch {
            return this.state.speaking;
        }
    }

    private drainCompleted(flush: boolean) {
        const tail = this.turnBuffer.slice(this.consumedLength);
        const { chunks, remainder } = splitSpeakableText(tail, { flush });
        this.consumedLength = this.turnBuffer.length - remainder.length;
        if (chunks.length === 0) return;
        for (const text of chunks) {
            this.queue.push({ turnId: this.activeTurnId!, text, generation: this.generation });
        }
        void this.pump();
    }

    private async pump() {
        if (this.pumping) return;
        this.pumping = true;
        try {
            while (this.queue.length > 0) {
                let provider: TTSProvider;
                try {
                    provider = await this.resolveProvider();
                } catch {
                    this.queue = [];
                    this.setState({ supported: false, speaking: false, error: ERROR_UNSUPPORTED });
                    break;
                }
                const item = this.queue.shift()!;
                if (item.generation !== this.generation) continue;
                this.activeUtterance = item;
                let done = () => {};
                const finished = new Promise<void>((resolve) => {
                    done = resolve;
                });
                this.currentResolve = done;
                const handlers: TTSUtteranceHandlers = {
                    onStart: () => {
                        if (this.isCurrent(item)) this.setState({ speaking: true, error: null });
                    },
                    onDone: () => done(),
                    onStopped: () => done(),
                    onError: () => {
                        if (this.isCurrent(item)) this.setState({ error: ERROR_PLAYBACK });
                        done();
                    },
                };
                try {
                    provider.synthesize(item.text, handlers);
                } catch (error) {
                    if (this.isCurrent(item)) this.setState({ error: ERROR_PLAYBACK });
                    done();
                }
                await finished;
                if (this.currentResolve === done) this.currentResolve = null;
                if (this.activeUtterance === item) this.activeUtterance = null;
            }
        } finally {
            this.pumping = false;
            if (this.queue.length > 0) {
                void this.pump();
            } else if (!this.activeUtterance) {
                this.setState({ speaking: false });
            }
        }
    }

    private isCurrent(item: QueuedUtterance) {
        return item.generation === this.generation && this.activeUtterance === item;
    }

    private async resolveProvider(): Promise<TTSProvider> {
        if (this.provider) return this.provider;
        if (!this.providerPromise) {
            this.providerPromise = import("./providers/expo-speech.provider").then((module) => {
                const provider = module.createExpoSpeechProvider();
                provider.configure(this.config);
                this.provider = provider;
                this.emit();
                return provider;
            });
        }
        return this.providerPromise;
    }

    private expireTurn(turnId: string) {
        this.expiredTurns.add(turnId);
        if (this.expiredTurns.size > 20) {
            const oldest = this.expiredTurns.values().next().value;
            if (oldest) this.expiredTurns.delete(oldest);
        }
    }

    private setState(patch: Partial<TTSState>) {
        const next: TTSState = { ...this.state, ...patch };
        if (next.speaking === this.state.speaking && next.error === this.state.error && next.supported === this.state.supported) return;
        this.state = next;
        this.emit();
    }

    private emit() {
        for (const listener of this.listeners) listener(this.state);
    }
}

export const ttsService = new TTSService();
