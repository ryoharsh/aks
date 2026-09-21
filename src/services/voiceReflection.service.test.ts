import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
    supabase: { functions: { invoke: vi.fn() } },
    isSupabaseConfigured: true,
}));

import { supabase } from "@/lib/supabase";
import { voiceReflectionService } from "./voiceReflection.service";

const invoke = supabase.functions.invoke as ReturnType<typeof vi.fn>;

function functionError(code: string) {
    return {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: { clone: () => ({ json: async () => ({ error: { code } }) }) },
    };
}

const successResult = {
    reflectionId: "reflection-1",
    createdAt: "2026-09-21T00:00:00.000Z",
    replayed: false,
    processing: { signalsSaved: 0, signals: [], memoryCandidates: [], patternActions: [] },
};

beforeEach(() => {
    vi.stubGlobal("__DEV__", false);
    invoke.mockReset();
});

describe("voiceReflectionService.submitText", () => {
    it("submits an on-device transcript through the same pipeline", async () => {
        invoke.mockResolvedValue({ data: successResult, error: null });
        const result = await voiceReflectionService.submitText("Hello Aks", "request-1");
        expect(result).toEqual(successResult);
        expect(invoke).toHaveBeenCalledWith("voice-reflection", { body: { text: "Hello Aks", requestId: "request-1" } });
    });

    it("surfaces the exact server code for the fallback decision", async () => {
        invoke.mockResolvedValue({ data: null, error: functionError("TRANSCRIPTION_NOT_CONFIGURED") });
        await expect(voiceReflectionService.submitText("Hello")).rejects.toThrow("TRANSCRIPTION_NOT_CONFIGURED");
    });

    it("rejects empty transcripts before any network call", async () => {
        await expect(voiceReflectionService.submitText("   ")).rejects.toThrow("EMPTY_TRANSCRIPTION");
        expect(invoke).not.toHaveBeenCalled();
    });

    it("maps transport failures without a code to VOICE_UNAVAILABLE", async () => {
        invoke.mockResolvedValue({ data: null, error: new Error("network down") });
        await expect(voiceReflectionService.submitText("Hello")).rejects.toThrow("VOICE_UNAVAILABLE");
    });
});

describe("voiceReflectionService.upload", () => {
    it("keeps mapping server codes after the refactor", async () => {
        invoke.mockResolvedValue({ data: null, error: functionError("TRANSCRIPTION_NOT_CONFIGURED") });
        await expect(voiceReflectionService.upload("AAAA", "audio/m4a")).rejects.toThrow("TRANSCRIPTION_NOT_CONFIGURED");
    });
});
