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
    processMessageStream: vi.fn(),
    processObservations: vi.fn(),
    createCheckIn: vi.fn(),
    createRealtimeSession: vi.fn(),
}));

vi.mock("@/services/conversations.service", () => ({
    conversationsService: { saveUserMessage: mocks.saveUserMessage },
}));
vi.mock("@/repositories/mirror.repository", () => ({
    mirrorRepository: { processMessage: mocks.processMessage, processMessageStream: mocks.processMessageStream, processObservations: mocks.processObservations },
    MirrorRepositoryError: class MirrorRepositoryError extends Error {
        constructor(public readonly code: string) {
            super(code);
        }
    },
}));
vi.mock("@/services/checkIns.service", () => ({
    checkInsService: { createCheckIn: mocks.createCheckIn },
}));
vi.mock("@/repositories/checkIns.repository", () => ({
    checkInsRepository: { create: vi.fn() },
    createCheckInRequestId: () => "check-in-request-id",
}));
vi.mock("./checkIns.repository", () => ({
    checkInsRepository: { create: vi.fn() },
    createCheckInRequestId: () => "check-in-request-id",
}));
vi.mock("@/services/mirror-realtime.service", () => ({
    mirrorRealtimeService: { createSession: mocks.createRealtimeSession },
}));

import { mirrorService } from "./mirror.service";

describe("mirror service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.saveUserMessage.mockResolvedValue({ conversationId: "conversation-1", message: userMessage });
        mocks.processObservations.mockResolvedValue({ signalsSaved: 0, signals: [], memoryCandidates: [], patternActions: [] });
        mocks.processMessageStream.mockRejectedValue(new Error("stream unavailable"));
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
        expect(mocks.processObservations).toHaveBeenCalledWith("conversation-1", "message-user");
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
        expect(mocks.processObservations).not.toHaveBeenCalled();
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

    it("streams the reply and forwards deltas", async () => {
        const deltas: string[] = [];
        mocks.processMessageStream.mockImplementation(async (_conversationId: string, _userMessageId: string, onDelta: (text: string) => void) => {
            onDelta("Hi");
            return {
                conversationId: "conversation-1",
                response: { response: { text: assistantMessage.content }, followUp: null },
                assistantMessage,
                observable: true,
            };
        });
        const result = await mirrorService.sendMessage(null, userMessage.content, "request-stream", {}, (text) => deltas.push(text));
        expect(deltas).toEqual(["Hi"]);
        expect(mocks.processMessage).not.toHaveBeenCalled();
        expect(result.assistantMessage).toEqual(assistantMessage);
        expect(result.result?.signals).toEqual([]);
        expect(result.result?.memoryCandidates).toEqual([]);
        expect(result.result?.patternActions).toEqual([]);
    });

    it("falls back to non-streaming when the stream fails", async () => {
        mocks.processMessage.mockResolvedValue({ assistantMessage, response: { response: { text: assistantMessage.content }, followUp: null }, signals: [] });
        const deltas: string[] = [];
        const result = await mirrorService.sendMessage(null, userMessage.content, "request-fallback", {}, (text) => deltas.push(text));
        expect(mocks.processMessageStream).toHaveBeenCalledWith("conversation-1", "message-user", expect.any(Function));
        expect(mocks.processMessage).toHaveBeenCalledWith("conversation-1", "message-user");
        expect(deltas).toEqual([]);
        expect(result.assistantMessage).toEqual(assistantMessage);
    });

    it("preserves the check-in and voice boundaries", async () => {
        mocks.createCheckIn.mockResolvedValue({ id: "check-in" });
        await expect(mirrorService.sendCheckIn({ mood: "okay" }, "request-check-in")).resolves.toEqual({ id: "check-in" });
        expect(mocks.createCheckIn).toHaveBeenCalledWith({ mood: "okay" }, "request-check-in");
        const stubSession = { start: vi.fn(), stop: vi.fn(), interrupt: vi.fn(), dispose: vi.fn() };
        mocks.createRealtimeSession.mockReturnValue(stubSession);
        const session = mirrorService.sendVoice({ conversationId: "conversation-1" });
        expect(mocks.createRealtimeSession).toHaveBeenCalledWith({ conversationId: "conversation-1" });
        expect(session).toBe(stubSession);
    });
});
