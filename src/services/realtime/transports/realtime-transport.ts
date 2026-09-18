import type { RealtimeSessionSpec, RealtimeTransport, RealtimeTransportCloseInfo } from "../types";
import { MirrorRealtimeError } from "../types";

export interface WebSocketLike {
    readonly readyState: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    addEventListener(type: "open" | "message" | "error" | "close", listener: (event: { data?: unknown }) => void): void;
}

export type WebSocketFactory = (url: string, options: { protocols?: string | string[]; headers?: Record<string, string> }) => WebSocketLike;

const READY_STATE_OPEN = 1;

const defaultWebSocketFactory: WebSocketFactory = (url, options) => {
    const ctor = WebSocket as unknown as (
        url: string,
        protocols?: string | string[],
        options?: { headers?: Record<string, string> },
    ) => WebSocketLike;
    return ctor(url, options.protocols ?? undefined, { headers: options.headers });
};

export function createRealtimeTransport(spec: RealtimeSessionSpec, webSocketFactory?: WebSocketFactory): RealtimeTransport {
    switch (spec.transport) {
        case "websocket":
            return createWebSocketTransport({ webSocketFactory });
        case "webrtc":
            throw new MirrorRealtimeError(
                "REALTIME_TRANSPORT_UNAVAILABLE",
                false,
                "The WebRTC transport requires a native development build. Configure this provider to use a WebSocket transport instead.",
            );
        default:
            throw new MirrorRealtimeError("REALTIME_TRANSPORT_UNAVAILABLE", false, `The provider requested an unsupported transport ("${String(spec.transport)}").`);
    }
}

export function createWebSocketTransport(options: { webSocketFactory?: WebSocketFactory } = {}): RealtimeTransport {
    const factory = options.webSocketFactory ?? defaultWebSocketFactory;
    let socket: WebSocketLike | null = null;
    let pending: string[] = [];
    let messageListeners = new Set<(raw: unknown) => void>();
    let closeListeners = new Set<(info: RealtimeTransportCloseInfo) => void>();
    let errorListeners = new Set<(error: Error) => void>();
    let closed = false;

    const flushQueue = () => {
        if (!socket || socket.readyState !== READY_STATE_OPEN) return;
        const queued = pending;
        pending = [];
        for (const payload of queued) socket.send(payload);
    };

    return {
        kind: "websocket",
        connect(spec: RealtimeSessionSpec) {
            return new Promise<void>((resolve, reject) => {
                if (socket) throw new MirrorRealtimeError("REALTIME_SESSION_UNAVAILABLE", true, "The voice session is already connected.");
                socket = factory(spec.endpoint, {
                    protocols: [],
                    headers: spec.sessionToken ? { Authorization: `Bearer ${spec.sessionToken}` } : undefined,
                });
                const timeout = setTimeout(() => {
                    reject(new MirrorRealtimeError("REALTIME_SESSION_UNAVAILABLE", true, "The voice session timed out."));
                    socket?.close();
                }, 10000);

                socket.addEventListener("open", () => {
                    clearTimeout(timeout);
                    flushQueue();
                    resolve();
                });
                socket.addEventListener("error", () => {
                    clearTimeout(timeout);
                    errorListeners.forEach((listener) => listener(new Error("The voice connection lost its link.")));
                });
                socket.addEventListener("message", (event) => {
                    const raw = event.data;
                    if (typeof raw !== "string") return;
                    try {
                        messageListeners.forEach((listener) => listener(JSON.parse(raw) as unknown));
                    } catch {
                        errorListeners.forEach((listener) => listener(new Error("The voice provider sent an unreadable message.")));
                    }
                });
                socket.addEventListener("close", (event) => {
                    clearTimeout(timeout);
                    const data = event.data;
                    const code = typeof data === "number" ? data : 1006;
                    const info: RealtimeTransportCloseInfo = { code, reason: "", wasClean: code === 1000 };
                    closeListeners.forEach((listener) => listener(info));
                });
            });
        },
        send(payload: unknown) {
            if (closed) throw new MirrorRealtimeError("REALTIME_SESSION_UNAVAILABLE", true, "The voice session is closed.");
            const serialized = JSON.stringify(payload);
            if (socket && socket.readyState === READY_STATE_OPEN) {
                socket.send(serialized);
                return;
            }
            pending.push(serialized);
        },
        async close() {
            closed = true;
            socket?.close(1000, "closing");
            socket = null;
        },
        onMessage(listener) {
            messageListeners.add(listener);
            return () => messageListeners.delete(listener);
        },
        onClose(listener) {
            closeListeners.add(listener);
            return () => closeListeners.delete(listener);
        },
        onError(listener) {
            errorListeners.add(listener);
            return () => errorListeners.delete(listener);
        },
    };
}