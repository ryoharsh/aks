import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getItemAsync: vi.fn(),
    setItemAsync: vi.fn(),
    deleteItemAsync: vi.fn(),
}));

vi.mock("expo-secure-store", () => mocks);
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import { draftService } from "./draft.service";

const KEY = "aks.draft.user-1.mirror-home";

describe("draft service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.setItemAsync.mockResolvedValue(undefined);
        mocks.deleteItemAsync.mockResolvedValue(undefined);
    });

    it("stores a draft under a user- and scope-specific key", async () => {
        await draftService.set("user-1", "mirror-home", "I keep switching tasks");
        expect(mocks.setItemAsync).toHaveBeenCalledWith(KEY, "I keep switching tasks");
    });

    it("reads back the stored draft", async () => {
        mocks.getItemAsync.mockResolvedValue("half a thought");
        await expect(draftService.get("user-1", "mirror-home")).resolves.toBe("half a thought");
        expect(mocks.getItemAsync).toHaveBeenCalledWith(KEY);
    });

    it("returns an empty draft when nothing is stored", async () => {
        mocks.getItemAsync.mockResolvedValue(null);
        await expect(draftService.get("user-1", "mirror-home")).resolves.toBe("");
    });

    it("drops the draft when the text becomes blank", async () => {
        await draftService.set("user-1", "mirror-home", "   ");
        expect(mocks.setItemAsync).not.toHaveBeenCalled();
        expect(mocks.deleteItemAsync).toHaveBeenCalledWith(KEY);
    });

    it("clears an explicitly discarded draft", async () => {
        await draftService.clear("user-1", "mirror-home");
        expect(mocks.deleteItemAsync).toHaveBeenCalledWith(KEY);
    });

    it("never throws when local storage fails", async () => {
        mocks.setItemAsync.mockRejectedValue(new Error("keychain unavailable"));
        mocks.getItemAsync.mockRejectedValue(new Error("keychain unavailable"));
        mocks.deleteItemAsync.mockRejectedValue(new Error("keychain unavailable"));
        await expect(draftService.set("user-1", "mirror-home", "text")).resolves.toBeUndefined();
        await expect(draftService.get("user-1", "mirror-home")).resolves.toBe("");
        await expect(draftService.clear("user-1", "mirror-home")).resolves.toBeUndefined();
    });

    it("keeps separate scopes apart", async () => {
        await draftService.set("user-1", "conversation-9", "for this chat");
        expect(mocks.setItemAsync).toHaveBeenCalledWith("aks.draft.user-1.conversation-9", "for this chat");
    });
});
