import { describe, expect, it } from "vitest";

import { isAiConversationEnabled } from "./aiConversation";

describe("ai conversation flag", () => {
    it("1. missing variable means the screen is disabled", () => {
        expect(isAiConversationEnabled({})).toBe(false);
        expect(isAiConversationEnabled({ EXPO_PUBLIC_ENABLE_AI_CONVERSATION: undefined })).toBe(false);
    });

    it("2. \"false\" means the screen is disabled", () => {
        expect(isAiConversationEnabled({ EXPO_PUBLIC_ENABLE_AI_CONVERSATION: "false" })).toBe(false);
        expect(isAiConversationEnabled({ EXPO_PUBLIC_ENABLE_AI_CONVERSATION: "" })).toBe(false);
        expect(isAiConversationEnabled({ EXPO_PUBLIC_ENABLE_AI_CONVERSATION: "0" })).toBe(false);
    });

    it("3. \"true\" enables the screen", () => {
        expect(isAiConversationEnabled({ EXPO_PUBLIC_ENABLE_AI_CONVERSATION: "true" })).toBe(true);
    });

    it("does not rely on truthiness (\"TRUE\"/\"1\" stay disabled)", () => {
        expect(isAiConversationEnabled({ EXPO_PUBLIC_ENABLE_AI_CONVERSATION: "TRUE" })).toBe(false);
        expect(isAiConversationEnabled({ EXPO_PUBLIC_ENABLE_AI_CONVERSATION: "1" })).toBe(false);
    });
});
