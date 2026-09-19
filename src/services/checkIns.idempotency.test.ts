import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    rpc: vi.fn(),
    requireAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
    supabase: { rpc: mocks.rpc },
    isSupabaseConfigured: true,
    supabaseUrl: "https://placeholder.supabase.co",
}));
vi.mock("@/repositories/data.repository", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/repositories/data.repository")>();
    return {
        ...original,
        requireAuthenticatedUser: mocks.requireAuthenticatedUser,
    };
});

import { checkInsRepository } from "@/repositories/checkIns.repository";

const user = { id: "user-a" } as never;

describe("check-in idempotency", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireAuthenticatedUser.mockResolvedValue(user);
    });

    it("persists a check-in through the database RPC and returns it", async () => {
        mocks.rpc.mockResolvedValue({ data: { id: "check-in-1", created_at: "2026-09-20T10:00:00Z", replayed: false }, error: null });
        const result = await checkInsRepository.create({ mood: "good" }, "request-1");
        expect(mocks.rpc).toHaveBeenCalledWith("create_check_in", expect.objectContaining({
            check_in_user_id: "user-a",
            request_id: "request-1",
        }));
        expect(result.id).toBe("check-in-1");
        expect(result.mood).toBe("good");
    });

    it("replays the original check-in for a repeated request id without duplicating", async () => {
        mocks.rpc.mockResolvedValue({ data: { id: "check-in-1", created_at: "2026-09-20T10:00:00Z", replayed: true }, error: null });
        const first = await checkInsRepository.create({ mood: "good" }, "request-1");
        const second = await checkInsRepository.create({ mood: "good" }, "request-1");
        expect(mocks.rpc).toHaveBeenCalledTimes(2);
        expect(first.id).toBe("check-in-1");
        expect(second.id).toBe("check-in-1");
        expect(second.createdAt).toBe(first.createdAt);
    });

    it("throws instead of claiming success when the RPC fails", async () => {
        mocks.rpc.mockResolvedValue({ data: null, error: { message: "duplicate key value" } });
        await expect(checkInsRepository.create({ mood: "chaos" }, "request-2")).rejects.toThrow();
        expect(mocks.rpc).toHaveBeenCalledOnce();
    });
});
