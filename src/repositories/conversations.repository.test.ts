import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    rpc: vi.fn(),
    from: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
    supabase: { auth: { getUser: mocks.getUser }, rpc: mocks.rpc, from: mocks.from },
}));

import { conversationsRepository } from "./conversations.repository";

const conversationRow = {
    id: "conversation-1",
    title: "Morning focus",
    created_at: "2026-09-18T08:00:00.000Z",
    updated_at: "2026-09-18T09:00:00.000Z",
    archived_at: null,
};

function tableQuery(result: { data: unknown[]; error: null }) {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.order = () => builder;
    builder.range = () => builder;
    builder.is = () => builder;
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return builder;
}

describe("conversations repository search", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    });

    it("searches titles and message content server-side with pagination", async () => {
        mocks.rpc.mockResolvedValue({ data: { items: [conversationRow], has_more: true }, error: null });
        const page = await conversationsRepository.list({ page: 1, pageSize: 20 }, false, "  focus  ");
        expect(mocks.rpc).toHaveBeenCalledWith("search_conversations", {
            search_query: "focus",
            page_offset: 20,
            page_size: 20,
        });
        expect(mocks.from).not.toHaveBeenCalled();
        expect(page.items).toEqual([{
            id: "conversation-1",
            title: "Morning focus",
            createdAt: "2026-09-18T08:00:00.000Z",
            updatedAt: "2026-09-18T09:00:00.000Z",
            archivedAt: null,
        }]);
        expect(page.hasMore).toBe(true);
    });

    it("returns no results when the search response is empty", async () => {
        mocks.rpc.mockResolvedValue({ data: null, error: null });
        const page = await conversationsRepository.list({ page: 0, pageSize: 20 }, false, "nothing");
        expect(page).toEqual({ items: [], hasMore: false });
    });

    it("surfaces a search failure instead of silently returning nothing", async () => {
        mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
        await expect(conversationsRepository.list({ page: 0 }, false, "focus")).rejects.toThrow();
    });

    it("does not search when the term is blank", async () => {
        mocks.from.mockReturnValue(tableQuery({ data: [conversationRow], error: null }));
        const page = await conversationsRepository.list({ page: 0, pageSize: 20 }, false, "   ");
        expect(mocks.rpc).not.toHaveBeenCalled();
        expect(mocks.from).toHaveBeenCalledWith("conversations");
        expect(page.items).toHaveLength(1);
    });
});

describe("conversations repository message editing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    });

    it("edits the latest unanswered message through the server-side guard", async () => {
        mocks.rpc.mockResolvedValue({
            data: { id: "message-1", conversation_id: "conversation-1", content: "Starting is hard today.", created_at: "2026-09-18T10:00:00.000Z", metadata: { source: "mirror" } },
            error: null,
        });
        const message = await conversationsRepository.editMessage("message-1", "  Starting is hard today.  ");

        expect(mocks.rpc).toHaveBeenCalledWith("edit_user_message", {
            target_message_id: "message-1",
            new_content: "Starting is hard today.",
        });
        expect(message).toEqual({
            id: "message-1",
            conversationId: "conversation-1",
            role: "user",
            content: "Starting is hard today.",
            replyToMessageId: null,
            metadata: { source: "mirror" },
            createdAt: "2026-09-18T10:00:00.000Z",
        });
    });

    it("refuses to edit an empty message", async () => {
        await expect(conversationsRepository.editMessage("message-1", "   ")).rejects.toThrow();
        expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it("surfaces a refused edit instead of silently dropping it", async () => {
        mocks.rpc.mockResolvedValue({ data: null, error: { message: "MESSAGE_ALREADY_ANSWERED" } });
        await expect(conversationsRepository.editMessage("message-1", "Rewritten")).rejects.toThrow();
    });
});
