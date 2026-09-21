import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAICompatibleProvider } from "./openai-compatible.ts";
import { isPolicyBlockedError } from "../types.ts";

const request = {
    task: "conversation_response" as const,
    version: "conversation_response_v1",
    instructions: "Respond safely.",
    context: { currentMessage: "Starting is difficult." },
};

const envelope = '{"safety":{"risk":"none"},"response":{"text":"What makes beginning difficult?"},"followUp":null}';

function completion(content: string, status = 200, headers: Record<string, string> = {}) {
    return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 5, completion_tokens: 7 } }), {
        status,
        headers: { "content-type": "application/json", ...headers },
    });
}

function sseResponse(chunks: string[], finalUsage?: { prompt_tokens: number; completion_tokens: number }) {
    const encoder = new TextEncoder();
    return new Response(new ReadableStream<Uint8Array>({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`));
            }
            if (finalUsage) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [], usage: finalUsage })}\n\n`));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
        },
    }), { status: 200, headers: { "content-type": "text/event-stream" } });
}

function provider() {
    return new OpenAICompatibleProvider("https://provider.test/v1", "test-key", "test-model");
}

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("OpenAI-compatible provider resilience", () => {
    it("retries a transient provider failure once and returns the successful attempt", async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response("upstream unavailable", { status: 503 }))
            .mockResolvedValueOnce(completion(envelope));
        vi.stubGlobal("fetch", fetchMock);

        const pending = provider().generate(request);
        await vi.advanceTimersByTimeAsync(10_000);
        const result = await pending;

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.content).toBe(envelope);
        expect(result.usage).toEqual({ inputTokens: 5, outputTokens: 7 });
    });

    it("does not retry a content-policy rejection", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { type: "content_policy_violation" } }), { status: 400 }));
        vi.stubGlobal("fetch", fetchMock);

        const error = await provider().generate(request).catch((caught: unknown) => caught);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(isPolicyBlockedError(error)).toBe(true);
        expect((error as { retryable: boolean }).retryable).toBe(false);
    });

    it("does not retry a deterministic client error", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(provider().generate(request)).rejects.toMatchObject({ status: 401, retryable: false });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("honours the provider's Retry-After instead of the default backoff", async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response("slow down", { status: 429, headers: { "retry-after": "0" } }))
            .mockResolvedValueOnce(completion(envelope));
        vi.stubGlobal("fetch", fetchMock);

        const pending = provider().generate(request);
        await vi.advanceTimersByTimeAsync(0);
        const result = await pending;

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.content).toBe(envelope);
    });
});

describe("OpenAI-compatible provider streaming", () => {
    it("streams response text only after safety resolves and decodes JSON escapes", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse([
            '{"safety":{"risk":"none"},',
            '"response":{"text":"Hi \\u00e9\\nthere"',
            '},"followUp":null}',
        ], { prompt_tokens: 11, completion_tokens: 4 })));

        const deltas: string[] = [];
        const result = await provider().generateStream(request, (text) => deltas.push(text));

        expect(deltas.join("")).toBe("Hi é\nthere");
        expect(result.content).toBe('{"safety":{"risk":"none"},"response":{"text":"Hi \\u00e9\\nthere"},"followUp":null}');
        expect(result.usage).toEqual({ inputTokens: 11, outputTokens: 4 });
    });

    it("never streams text for an imminent-risk turn", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse([
            '{"safety":{"risk":"imminent"},"response":{"text":"I should not be shown."},"followUp":null}',
        ])));

        const deltas: string[] = [];
        await provider().generateStream(request, (text) => deltas.push(text));

        expect(deltas).toEqual([]);
    });

    it("does not replay a stream once content has reached the caller", async () => {
        const encoder = new TextEncoder();
        let reads = 0;
        const fetchMock = vi.fn().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
            // The failure arrives after the caller has already received text.
            pull(controller) {
                reads += 1;
                if (reads === 1) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: '{"safety":{"risk":"none"},"response":{"text":"Partial' } }] })}\n\n`));
                    return;
                }
                controller.error(new Error("connection lost"));
            },
        }), { status: 200, headers: { "content-type": "text/event-stream" } }));
        vi.stubGlobal("fetch", fetchMock);

        const deltas: string[] = [];
        await expect(provider().generateStream(request, (text) => deltas.push(text))).rejects.toThrow("AI_PROVIDER_UNAVAILABLE");

        expect(deltas.join("")).toBe("Partial");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("keeps concurrent streams independent", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(sseResponse(['{"safety":{"risk":"none"},"response":{"text":"First"},"followUp":null}']))
            .mockResolvedValueOnce(sseResponse(['{"safety":{"risk":"none"},"response":{"text":"Second"},"followUp":null}']));
        vi.stubGlobal("fetch", fetchMock);

        const instance = provider();
        const first: string[] = [];
        const second: string[] = [];
        const [firstResult, secondResult] = await Promise.all([
            instance.generateStream(request, (text) => first.push(text)),
            instance.generateStream(request, (text) => second.push(text)),
        ]);

        expect(first.join("")).toBe("First");
        expect(second.join("")).toBe("Second");
        expect(firstResult.content).toContain("First");
        expect(secondResult.content).toContain("Second");
    });
});
