import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getItemAsync: vi.fn(),
    setItemAsync: vi.fn(),
    deleteItemAsync: vi.fn(),
}));

vi.mock("expo-secure-store", () => mocks);
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import { languageService } from "./language.service";

const KEY = "aks.language.user-1";

describe("language service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.setItemAsync.mockResolvedValue(undefined);
        mocks.deleteItemAsync.mockResolvedValue(undefined);
    });

    it("stores the chosen language under a user-specific key", async () => {
        await languageService.set("user-1", "hi");
        expect(mocks.setItemAsync).toHaveBeenCalledWith(KEY, "hi");
    });

    it("reads back a stored language", async () => {
        mocks.getItemAsync.mockResolvedValue("hi");
        await expect(languageService.get("user-1")).resolves.toBe("hi");
        expect(mocks.getItemAsync).toHaveBeenCalledWith(KEY);
    });

    it("returns null when no choice is stored", async () => {
        mocks.getItemAsync.mockResolvedValue(null);
        await expect(languageService.get("user-1")).resolves.toBeNull();
    });

    it("rejects an unknown stored code instead of trusting it", async () => {
        mocks.getItemAsync.mockResolvedValue("xx");
        await expect(languageService.get("user-1")).resolves.toBeNull();
    });

    it("clears the stored choice", async () => {
        await languageService.clear("user-1");
        expect(mocks.deleteItemAsync).toHaveBeenCalledWith(KEY);
    });

    it("never throws when local storage fails", async () => {
        mocks.setItemAsync.mockRejectedValue(new Error("keychain unavailable"));
        mocks.getItemAsync.mockRejectedValue(new Error("keychain unavailable"));
        mocks.deleteItemAsync.mockRejectedValue(new Error("keychain unavailable"));
        await expect(languageService.set("user-1", "hi")).resolves.toBeUndefined();
        await expect(languageService.get("user-1")).resolves.toBeNull();
        await expect(languageService.clear("user-1")).resolves.toBeUndefined();
    });
});
