import { beforeEach, describe, expect, it, vi } from "vitest";

const userMessage = {
    id: "message-user",
    conversationId: "conversation-1",
    role: "user" as const,
    content: "Starting feels difficult.",
    replyToMessageId: null,
    metadata: {},
    createdAt: "2026-09-17T10:00:00.000Z",
};
const assistantMessage = {
    id: "message-assistant",
    conversationId: "conversation-1",
    role: "assistant" as const,
    content: "Does the task feel heavy, or is beginning the difficult part?",
    replyToMessageId: "message-user",
    metadata: {},
    createdAt: "2026-09-17T10:00:01.000Z",
};

const mocks = vi.hoisted(() => ({
    saveUserMessage: vi.fn(),
    processMessage: vi.fn(),
    createCheckIn: vi.fn(),
}));

vi.mock("@/services/conversations.service", () => ({
    conversationsService: { saveUserMessage: mocks.saveUserMessage },
}));
vi.mock("@/repositories/mirror.repository", () => ({
    mirrorRepository: { processMessage: mocks.processMessage },
    MirrorRepositoryError: class MirrorRepositoryError extends Error {
        constructor(public readonly code: string) {
            super(code);
        }
    },
}));
vi.mock("@/services/checkIns.service", () => ({
    checkInsService: { createCheckIn: mocks.createCheckIn },
}));

import { mirrorService } from "./mirror.service";

describe("mirror service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.saveUserMessage.mockResolvedValue({ conversationId: "conversation-1", message: userMessage });
    });

    it("persists the first message before processing AI", async () => {
        mocks.processMessage.mockResolvedValue({
            assistantMessage,
            response: { response: { text: assistantMessage.content }, followUp: null },
            signals: [],
        });
        const result = await mirrorService.sendMessage(null, userMessage.content, "request-1");
        expect(mocks.saveUserMessage).toHaveBeenCalledWith(null, userMessage.content, "request-1", {});
        expect(mocks.processMessage).toHaveBeenCalledWith("conversation-1", "message-user");
        expect(result.assistantMessage).toEqual(assistantMessage);
    });

    it("continues an existing conversation", async () => {
        mocks.processMessage.mockResolvedValue({ assistantMessage, response: { response: { text: assistantMessage.content }, followUp: null }, signals: [] });
        await mirrorService.sendMessage("conversation-1", "Another message", "request-2");
        expect(mocks.saveUserMessage).toHaveBeenCalledWith("conversation-1", "Another message", "request-2", {});
    });

    it("keeps the saved user message when AI fails", async () => {
        mocks.processMessage.mockRejectedValue(new Error("provider failed"));
        const result = await mirrorService.sendMessage(null, userMessage.content, "request-3");
        expect(result.userMessage).toEqual(userMessage);
        expect(result.assistantMessage).toBeNull();
        expect(result.processingError?.code).toBe("AI_UNAVAILABLE");
        expect(result.processingError?.retryable).toBe(true);
    });

    it("retries processing without inserting another user message", async () => {
        mocks.processMessage.mockResolvedValue({ assistantMessage, response: { response: { text: assistantMessage.content }, followUp: null }, signals: [] });
        await mirrorService.retryMessage({ conversationId: "conversation-1", userMessage });
        expect(mocks.saveUserMessage).not.toHaveBeenCalled();
        expect(mocks.processMessage).toHaveBeenCalledOnce();
    });

    it("preserves the check-in and voice boundaries", async () => {
        mocks.createCheckIn.mockResolvedValue({ id: "check-in" });
        await expect(mirrorService.sendCheckIn({ mood: "okay" })).resolves.toEqual({ id: "check-in" });
        await expect(mirrorService.sendVoice("file://recording.m4a")).rejects.toThrow("VOICE_UNAVAILABLE");
    });
});
