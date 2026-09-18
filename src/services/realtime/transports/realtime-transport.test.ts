import { describe, expect, it, vi } from "vitest";
import { createWebSocketTransport, type WebSocketFactory, type WebSocketLike } from "./realtime-transport";
import type { RealtimeSessionSpec } from "../types";
import { MirrorRealtimeError } from "../types";

const spec: RealtimeSessionSpec = {
    conversationId: null,
    provider: "openai",
    protocol: "openai-realtime",
    transport: "websocket",
    endpoint: "wss://api.openai.com/v1/realtime?model=gpt-realtime",
    sessionToken: "ephemeral-token",
    tokenExpiresAt: null,
    model: "gpt-realtime",
    instructions: "You are Aks.",
    inputSampleRate: 24000,
    outputSampleRate: 24000,
    pcmFormat: "pcm16",
};

type FakeSocket = {
    socket: WebSocketLike;
    readyState: number;
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    open: () => void;
    closeFromServer: (data?: unknown) => void;
    message: (data: string) => void;
    url: string;
    opts: { protocols?: string | string[]; headers?: Record<string, string> };
};

function createFakeSocketFactory(): { factory: WebSocketFactory; sockets: FakeSocket[] } {
    const sockets: FakeSocket[] = [];
    const factory: WebSocketFactory = (url, opts) => {
        const fake: FakeSocket = {
            socket: undefined as unknown as WebSocketLike,
            readyState: 0,
            send: vi.fn(),
            close: vi.fn(),
            open: () => undefined,
            closeFromServer: () => undefined,
            message: () => undefined,
            url,
            opts,
        };
        fake.socket = {
            get readyState() {
                return fake.readyState;
            },
            send: (data) => fake.send(data),
            close: (code, reason) => fake.close(code, reason),
            addEventListener: (type, listener) => {
                if (type === "open") fake.open = () => {
                    fake.readyState = 1;
                    listener({});
                };
                if (type === "close") fake.closeFromServer = (data) => listener({ data });
                if (type === "message") fake.message = (data) => listener({ data });
            },
        };
        sockets.push(fake);
        return fake.socket;
    };
    return { factory, sockets };
}

describe("WebSocket realtime transport", () => {
    it("connects with the endpoint and a Bearer header, resolving on open", async () => {
        const { factory, sockets } = createFakeSocketFactory();
        const transport = createWebSocketTransport({ webSocketFactory: factory });
        const resolved = transport.connect(spec);

        expect(sockets[0].url).toBe(spec.endpoint);
        expect(sockets[0].opts.headers).toEqual({ Authorization: `Bearer ${spec.sessionToken}` });

        sockets[0].open();
        await resolved;
        expect(sockets[0].readyState).toBe(1);
    });

    it("queues messages until open and flushes them in order", async () => {
        const { factory, sockets } = createFakeSocketFactory();
        const transport = createWebSocketTransport({ webSocketFactory: factory });
        transport.send({ type: "response.cancel" });
        transport.send({ type: "response.cancel" });
        const resolved = transport.connect(spec);
        expect(sockets[0].send).not.toHaveBeenCalled();
        sockets[0].open();
        await resolved;

        expect(sockets[0].send).toHaveBeenCalledTimes(2);
        const messages = sockets[0].send.mock.calls.map((call) => JSON.parse(call[0] as string));
        expect(messages).toEqual([{ type: "response.cancel" }, { type: "response.cancel" }]);
    });

    it("parses incoming JSON and forwards events to message listeners", async () => {
        const { factory, sockets } = createFakeSocketFactory();
        const transport = createWebSocketTransport({ webSocketFactory: factory });
        const events: unknown[] = [];
        transport.onMessage((raw) => events.push(raw));
        const resolved = transport.connect(spec);
        sockets[0].open();
        await resolved;

        sockets[0].message(JSON.stringify({ type: "session.created" }));
        expect(events).toEqual([{ type: "session.created" }]);
    });

    it("surfaces unreadable provider messages as transport errors", async () => {
        const { factory, sockets } = createFakeSocketFactory();
        const transport = createWebSocketTransport({ webSocketFactory: factory });
        const errors: unknown[] = [];
        transport.onMessage(() => undefined);
        transport.onError((error) => errors.push(error.message));
        const resolved = transport.connect(spec);
        sockets[0].open();
        await resolved;

        sockets[0].message("this is not json");
        expect(errors[0]).toBe("The voice provider sent an unreadable message.");
    });

    it("reports a clean close with code 1000 as wasClean", async () => {
        const { factory, sockets } = createFakeSocketFactory();
        const transport = createWebSocketTransport({ webSocketFactory: factory });
        const closes: unknown[] = [];
        transport.onClose((info) => closes.push(info));
        const resolved = transport.connect(spec);
        sockets[0].open();
        await resolved;

        sockets[0].closeFromServer(1000);
        expect(closes).toEqual([{ code: 1000, reason: "", wasClean: true }]);
    });

    it("reports an unexpected close (code 1006) as not clean", async () => {
        const { factory, sockets } = createFakeSocketFactory();
        const transport = createWebSocketTransport({ webSocketFactory: factory });
        const closes: unknown[] = [];
        transport.onClose((info) => closes.push(info));
        const resolved = transport.connect(spec);
        sockets[0].open();
        await resolved;

        sockets[0].closeFromServer(1006);
        expect(closes).toEqual([{ code: 1006, reason: "", wasClean: false }]);
    });

    it("closes cleanly and rejects further sends", async () => {
        const { factory, sockets } = createFakeSocketFactory();
        const transport = createWebSocketTransport({ webSocketFactory: factory });
        const resolved = transport.connect(spec);
        sockets[0].open();
        await resolved;

        await transport.close();
        expect(sockets[0].close).toHaveBeenCalledWith(1000, "closing");
        expect(() => transport.send({ type: "response.cancel" })).toThrow(MirrorRealtimeError);
    });
});