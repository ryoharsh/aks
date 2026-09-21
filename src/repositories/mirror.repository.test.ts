import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getSession: vi.fn(),
    streamingFetch: vi.fn(),
    invoke: vi.fn(),
}));

vi.mock("expo/fetch", () => ({ fetch: mocks.streamingFetch }));
vi.mock("@/lib/supabase", () => ({
    supabase: { auth: { getSession: mocks.getSession }, functions: { invoke: mocks.invoke } },
    supabaseUrl: "https://test.supabase.co",
    assertSupabaseConfigured: () => undefined,
}));

import { MirrorRepositoryError, mirrorRepository } from "./mirror.repository";

const assistantMessage = {
    id: "message-assistant",
    conversationId: "conversation-1",
    role: "assistant" as const,
    content: "Hello world",
    replyToMessageId: "message-user",
    metadata: {},
    createdAt: "2026-09-17T10:00:01.000Z",
};

function sseResponse(events: Array<Record<string, unknown>>): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            for (const event of events) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            }
            controller.close();
        },
    });
    return new Response(stream, { status: 200 });
}

const doneEvent = {
    type: "done",
    conversationId: "conversation-1",
    response: { response: { text: assistantMessage.content }, followUp: null },
    assistantMessage,
    observable: true,
};

describe("mirror repository stream", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getSession.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
    });

    it("accumulates deltas and resolves the done event", async () => {
        mocks.streamingFetch.mockResolvedValue(sseResponse([
            { type: "delta", text: "Hello" },
            { type: "delta", text: " world" },
            doneEvent,
        ]));
        const deltas: string[] = [];
        const result = await mirrorRepository.processMessageStream("conversation-1", "message-user", (text) => deltas.push(text));
        expect(deltas).toEqual(["Hello", "Hello world"]);
        expect(result.assistantMessage).toEqual(assistantMessage);
        expect(result.response.response.text).toBe("Hello world");
        expect(mocks.streamingFetch).toHaveBeenCalledWith(
            "https://test.supabase.co/functions/v1/mirror-stream",
            expect.objectContaining({ method: "POST" }),
        );
    });

    it("replaces accumulated text when a delta is marked replace", async () => {
        mocks.streamingFetch.mockResolvedValue(sseResponse([
            { type: "delta", text: "Hel" },
            { type: "delta", text: "Hello", replace: true },
            doneEvent,
        ]));
        const deltas: string[] = [];
        await mirrorRepository.processMessageStream("conversation-1", "message-user", (text) => deltas.push(text));
        expect(deltas).toEqual(["Hel", "Hello"]);
    });

    it("maps error events to repository errors", async () => {
        mocks.streamingFetch.mockResolvedValue(sseResponse([{ type: "error", code: "RATE_LIMITED" }]));
        await expect(mirrorRepository.processMessageStream("conversation-1", "message-user", () => undefined))
            .rejects.toMatchObject({ code: "RATE_LIMITED" });
    });

    it("maps non-OK JSON error bodies to repository errors", async () => {
        mocks.streamingFetch.mockResolvedValue(new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404 }));
        await expect(mirrorRepository.processMessageStream("conversation-1", "message-user", () => undefined))
            .rejects.toMatchObject({ code: "CONVERSATION_UNAVAILABLE" });
    });

    it("throws when the stream ends without a done event", async () => {
        mocks.streamingFetch.mockResolvedValue(sseResponse([{ type: "delta", text: "partial" }]));
        await expect(mirrorRepository.processMessageStream("conversation-1", "message-user", () => undefined))
            .rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    });

    it("skips malformed SSE lines", async () => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(encoder.encode("data: {broken\n\ndata: "));
                controller.enqueue(encoder.encode(JSON.stringify({ type: "delta", text: "ok" }) + "\n\n"));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));
                controller.close();
            },
        });
        mocks.streamingFetch.mockResolvedValue(new Response(stream, { status: 200 }));
        const deltas: string[] = [];
        const result = await mirrorRepository.processMessageStream("conversation-1", "message-user", (text) => deltas.push(text));
        expect(deltas).toEqual(["ok"]);
        expect(result.assistantMessage).toEqual(assistantMessage);
    });

    it("rejects when there is no session token", async () => {
        mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
        await expect(mirrorRepository.processMessageStream("conversation-1", "message-user", () => undefined))
            .rejects.toBeInstanceOf(MirrorRepositoryError);
        expect(mocks.streamingFetch).not.toHaveBeenCalled();
    });
});

describe("mirror repository turn options", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getSession.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
    });

    const sentBody = () => JSON.parse(mocks.streamingFetch.mock.calls[0][1].body);

    it("sends the language the app is displaying", async () => {
        mocks.streamingFetch.mockResolvedValue(sseResponse([doneEvent]));
        await mirrorRepository.processMessageStream("conversation-1", "message-user", () => undefined, { language: "hi" });
        expect(sentBody()).toMatchObject({ conversationId: "conversation-1", language: "hi" });
    });

    it("omits the language when the caller has none, so the server keeps the stored one", async () => {
        mocks.streamingFetch.mockResolvedValue(sseResponse([doneEvent]));
        await mirrorRepository.processMessageStream("conversation-1", "message-user", () => undefined);
        expect(sentBody().language).toBeUndefined();
    });

    it("sends the language on the non-streaming fallback too", async () => {
        mocks.invoke.mockResolvedValue({
            data: {
                conversationId: "conversation-1",
                response: { response: { text: "Hello world" }, followUp: null },
                assistantMessage,
                signalsSaved: 0,
                signals: [],
                memoryCandidates: [],
                patternActions: [],
                observable: true,
            },
            error: null,
        });
        await mirrorRepository.processMessage("conversation-1", "message-user", { language: "ur" });
        expect(mocks.invoke).toHaveBeenCalledWith("mirror", { body: expect.objectContaining({ language: "ur" }) });
    });
});
