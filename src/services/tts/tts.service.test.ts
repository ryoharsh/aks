import { describe, expect, it, vi } from "vitest";

import { MAX_UTTERANCE_CHARS, MIN_UTTERANCE_CHARS, TTSService, splitSpeakableText } from "./tts.service";
import type { TTSProvider, TTSState, TTSUtteranceHandlers, TTSCapabilities } from "./tts.types";

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

type FakeProvider = TTSProvider & {
    spoken: string[];
    finish: () => void;
    fail: (error: Error) => void;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    configure: ReturnType<typeof vi.fn>;
};

function createFakeProvider(overrides: Partial<TTSCapabilities> = {}): FakeProvider {
    let current: TTSUtteranceHandlers | null = null;
    const spoken: string[] = [];
    const provider: FakeProvider = {
        id: "fake",
        spoken,
        getCapabilities: () => ({ streaming: false, pauseResume: true, interruptible: true, ...overrides }),
        configure: vi.fn(),
        synthesize(text, handlers) {
            spoken.push(text);
            current = handlers;
            handlers.onStart?.();
        },
        stop: vi.fn(async () => {
            const active = current;
            current = null;
            active?.onStopped?.();
        }),
        pause: vi.fn(async () => undefined),
        resume: vi.fn(async () => undefined),
        isSpeaking: vi.fn(async () => current !== null),
        finish() {
            const active = current;
            current = null;
            active?.onDone?.();
        },
        fail(error: Error) {
            const active = current;
            current = null;
            active?.onError?.(error);
        },
    };
    return provider;
}

function createService() {
    const service = new TTSService();
    const provider = createFakeProvider();
    service.registerProvider(provider);
    const states: TTSState[] = [];
    service.subscribe((state) => states.push({ ...state }));
    return { service, provider, states };
}

describe("splitSpeakableText", () => {
    it("merges tiny sentence fragments instead of emitting 1–3 word utterances", () => {
        const { chunks, remainder } = splitSpeakableText("Hi. There.", { flush: false });
        expect(chunks).toEqual(["Hi. There."]);
        expect(remainder).toBe("");
    });

    it("holds incomplete text back as remainder", () => {
        const { chunks, remainder } = splitSpeakableText("Hello there, how", { flush: false });
        expect(chunks).toEqual([]);
        expect(remainder).toBe("Hello there, how");
    });

    it("flushes a short final answer when the turn ends", () => {
        const { chunks, remainder } = splitSpeakableText("Yes.", { flush: true });
        expect(chunks).toEqual(["Yes."]);
        expect(remainder).toBe("");
    });

    it("hard-splits long punctuation-free runs at the character threshold", () => {
        const longRun = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat";
        const { chunks, remainder } = splitSpeakableText(longRun, { flush: true });
        expect(remainder).toBe("");
        expect(chunks.length).toBeGreaterThan(1);
        for (const chunk of chunks) {
            expect(chunk.length).toBeLessThanOrEqual(MAX_UTTERANCE_CHARS);
        }
        expect(chunks.join(" ").replace(/\s+/g, "")).toBe(longRun.replace(/\s+/g, ""));
    });

    it("emits complete sentences in order once they pass the minimum length", () => {
        const { chunks } = splitSpeakableText("Alpha beta gamma. Delta epsilon zeta. Eta.", { flush: false });
        expect(chunks).toEqual(["Alpha beta gamma.", "Delta epsilon zeta."]);
    });
});

describe("TTSService", () => {
    it("plays queued utterances strictly in order", async () => {
        const { service, provider } = createService();
        service.speakTurn("t1", "First sentence here. Second sentence here.");
        await vi.waitFor(() => expect(provider.spoken).toEqual(["First sentence here."]));
        expect(provider.spoken).toHaveLength(1);
        provider.finish();
        await vi.waitFor(() => expect(provider.spoken).toEqual(["First sentence here.", "Second sentence here."]));
    });

    it("streams sentences as accumulated reply text grows", async () => {
        const { service, provider } = createService();
        service.updateTurn("t1", "Hello there friend.");
        await vi.waitFor(() => expect(provider.spoken).toEqual(["Hello there friend."]));
        service.updateTurn("t1", "Hello there friend. How are you doing today?");
        await settle();
        expect(provider.spoken).toHaveLength(1);
        provider.finish();
        await vi.waitFor(() => expect(provider.spoken[1]).toBe("How are you doing today?"));
        service.endTurn("t1", "Hello there friend. How are you doing today? Yes.");
        provider.finish();
        await vi.waitFor(() => expect(provider.spoken[2]).toBe("Yes."));
    });

    it("stop clears the pending queue so nothing else plays", async () => {
        const { service, provider } = createService();
        service.speakTurn("t1", "One is here ok. Two is here ok. Three is here ok.");
        await vi.waitFor(() => expect(provider.spoken).toHaveLength(1));
        service.stop();
        await settle();
        provider.finish();
        await settle();
        expect(provider.spoken).toHaveLength(1);
        expect(service.getState().speaking).toBe(false);
    });

    it("ignores deltas and flushes from a stale turn", async () => {
        const { service, provider } = createService();
        service.speakTurn("t1", "First sentence here.");
        await vi.waitFor(() => expect(provider.spoken).toHaveLength(1));
        service.speakTurn("t2", "Second turn sentence here.");
        provider.finish();
        await vi.waitFor(() => expect(provider.spoken).toEqual(["First sentence here.", "Second turn sentence here."]));
        service.updateTurn("t1", "First sentence here. Late stale words.");
        service.endTurn("t1", "First sentence here. Late stale words.");
        provider.finish();
        await settle();
        expect(provider.spoken).toHaveLength(2);
    });

    it("ignores a stopped turn that tries to resume", async () => {
        const { service, provider } = createService();
        service.speakTurn("t1", "First sentence here.");
        await vi.waitFor(() => expect(provider.spoken).toHaveLength(1));
        service.stop();
        await settle();
        service.updateTurn("t1", "First sentence here. Late stale words.");
        service.endTurn("t1", "First sentence here. Late stale words.");
        await settle();
        expect(provider.spoken).toHaveLength(1);
    });

    it("a failed utterance surfaces an error but playback continues and nothing throws", async () => {
        const { service, provider, states } = createService();
        service.speakTurn("t1", "Alpha sentence here. Beta sentence here.");
        await vi.waitFor(() => expect(provider.spoken).toHaveLength(1));
        expect(() => provider.fail(new Error("synthesis failed"))).not.toThrow();
        await vi.waitFor(() => expect(provider.spoken).toHaveLength(2));
        expect(states.some((state) => state.error !== null)).toBe(true);
        provider.finish();
        await vi.waitFor(() => expect(service.getState().speaking).toBe(false));
    });

    it("survives a provider that throws synchronously from synthesize", async () => {
        const { service, provider, states } = createService();
        provider.synthesize = (text) => {
            provider.spoken.push(text);
            throw new Error("sync boom");
        };
        expect(() => service.speakTurn("t1", "Alpha sentence here.")).not.toThrow();
        await settle();
        expect(states.some((state) => state.error !== null)).toBe(true);
        expect(service.getState().speaking).toBe(false);
    });

    it("reports isSpeaking while the queue has work and false when drained", async () => {
        const { service, provider } = createService();
        expect(await service.isSpeaking()).toBe(false);
        service.speakTurn("t1", "Alpha sentence here. Beta sentence here.");
        await vi.waitFor(() => expect(provider.spoken).toHaveLength(1));
        expect(await service.isSpeaking()).toBe(true);
        provider.finish();
        await vi.waitFor(() => expect(provider.spoken).toHaveLength(2));
        expect(await service.isSpeaking()).toBe(true);
        provider.finish();
        await vi.waitFor(() => expect(service.getState().speaking).toBe(false));
        expect(await service.isSpeaking()).toBe(false);
    });

    it("passes pause and resume through only when the provider supports them", async () => {
        const { service, provider } = createService();
        expect(await service.pause()).toBe(true);
        expect(provider.pause).toHaveBeenCalled();
        expect(await service.resume()).toBe(true);
        expect(provider.resume).toHaveBeenCalled();

        const limited = new TTSService();
        const limitedProvider = createFakeProvider({ pauseResume: false });
        limited.registerProvider(limitedProvider);
        expect(await limited.pause()).toBe(false);
        expect(limitedProvider.pause).not.toHaveBeenCalled();
        expect(await limited.resume()).toBe(false);
        expect(limitedProvider.resume).not.toHaveBeenCalled();
    });

    it("merges configure patches over centralized defaults", async () => {
        const { service, provider } = createService();
        service.configure({ speed: 1.2, voice: "voice-1" });
        expect(service.getConfig().speed).toBe(1.2);
        expect(service.getConfig().voice).toBe("voice-1");
        expect(service.getConfig().provider).toBe("expo-speech");
        expect(service.getConfig().outputFormat).toBe("pcm16");
        expect(provider.configure).toHaveBeenCalled();
        const passed = provider.configure.mock.calls.at(-1)![0];
        expect(passed.speed).toBe(1.2);
        expect(passed.pitch).toBe(1);
        expect(passed.sampleRate).toBe(24000);
    });
});
