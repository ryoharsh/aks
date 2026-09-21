import { describe, expect, it } from "vitest";

import { mergeMessageLists, mergeTurnMessages, optimisticMessageId } from "./mirrorTurnMerge";
import type { Message } from "@/types/data";

const user = (id: string, conversationId = "conversation-1"): Message => ({
    id,
    conversationId,
    role: "user",
    content: "Starting feels difficult.",
    replyToMessageId: null,
    metadata: {},
    createdAt: "2026-09-17T10:00:00.000Z",
});

const assistant = (id: string, replyTo: string): Message => ({
    id,
    conversationId: "conversation-1",
    role: "assistant",
    content: "What makes beginning difficult?",
    replyToMessageId: replyTo,
    metadata: {},
    createdAt: "2026-09-17T10:00:01.000Z",
});

describe("mergeTurnMessages", () => {
    it("uses a stable request-scoped optimistic id", () => {
        expect(optimisticMessageId("request-1")).toBe("pending-request-1");
        expect(optimisticMessageId("request-1")).toBe(optimisticMessageId("request-1"));
    });

    it("replaces the optimistic row with the real turn without duplicating", () => {
        const optimistic = user(optimisticMessageId("request-1"), "pending");
        const real = user("message-user");
        const reply = assistant("message-assistant", "message-user");
        const next = mergeTurnMessages([optimistic], real, reply, optimistic.id);
        expect(next.map((message) => message.id)).toEqual(["message-user", "message-assistant"]);
    });

    it("replaces a same-id regenerated reply instead of stacking", () => {
        const existing = [user("message-user"), assistant("message-assistant", "message-user")];
        const regenerated = { ...assistant("message-assistant", "message-user"), content: "A different question?" };
        const next = mergeTurnMessages(existing, null, regenerated);
        expect(next).toHaveLength(2);
        expect(next[1].content).toBe("A different question?");
    });

    it("keeps the sent message visible when the assistant reply failed", () => {
        const optimistic = user(optimisticMessageId("request-1"), "pending");
        const next = mergeTurnMessages([optimistic], null, null, null);
        expect(next).toEqual([optimistic]);
    });

    it("a retry upserts the same optimistic row instead of appending another", () => {
        const optimistic = user(optimisticMessageId("request-1"), "pending");
        const next = mergeTurnMessages([optimistic], optimistic, null);
        expect(next).toHaveLength(1);
    });
});

describe("mergeMessageLists", () => {
    it("adds persisted voice turns without duplicating history or optimistic rows", () => {
        const history = { ...user("message-1", "conversation-1"), createdAt: "2026-09-17T10:00:00.000Z" };
        const persisted = { ...user("message-2", "conversation-1"), createdAt: "2026-09-17T10:00:01.000Z" };
        const optimistic = { ...user(optimisticMessageId("request-9"), "pending"), createdAt: "2026-09-17T10:00:02.000Z" };
        const next = mergeMessageLists([history, optimistic], [history, persisted]);
        expect(next.map((message) => message.id)).toEqual([
            "message-1",
            "message-2",
            "pending-request-9",
        ]);
    });

    it("orders chronologically with a stable id tiebreak", () => {
        const older = { ...user("message-b"), createdAt: "2026-09-17T10:00:00.000Z" };
        const newer = { ...user("message-a"), createdAt: "2026-09-17T10:00:00.000Z" };
        const next = mergeMessageLists([newer], [older]);
        expect(next.map((message) => message.id)).toEqual(["message-a", "message-b"]);
    });
});
