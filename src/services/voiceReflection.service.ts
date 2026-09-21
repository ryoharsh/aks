import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type VoiceReflectionResult = {
    reflectionId: string;
    createdAt: string;
    replayed: boolean;
    processing: {
        signalsSaved: number;
        signals: Array<{ signalType: string; value: Record<string, unknown>; confidence: number | null }>;
        memoryCandidates: Array<{ action: string; memoryId: string; status: string }>;
        patternActions: Array<{ action: string; patternId: string; status: string }>;
    };
};

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

function createRequestId() {
    return globalThis.crypto?.randomUUID?.() ?? `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Latched once the server reports TRANSCRIPTION_NOT_CONFIGURED: from then
// on this device records nothing for transcription and the mic runs live
// on-device dictation instead. In-memory on purpose — an app restart
// re-probes the server, so configuring STT later heals automatically.
let serverTranscriptionUnavailable = false;

async function extractServerCode(error: unknown): Promise<string> {
    const context = (error as { context?: Response }).context;
    if (!context) return "";
    try {
        const payload = await context.clone().json() as { error?: { code?: string } };
        return payload.error?.code ?? "";
    } catch (parseError) {
        if (parseError instanceof Error && parseError.message && !/expected|json/i.test(parseError.message)) throw parseError;
        return "";
    }
}

function logInvokeFailure(error: unknown) {
    if (!__DEV__) return;
    const status = (error as { status?: unknown }).status ?? (error as { context?: { status?: unknown } }).context?.status;
    console.warn("[voice-reflection] invoke failed:", { name: (error as Error).name, message: (error as Error).message, status });
}

export const voiceReflectionService = {
    /** True once the server reported no STT: mic must dictate, not record. */
    get preferOnDevice() {
        return serverTranscriptionUnavailable;
    },
    markServerTranscriptionUnavailable() {
        serverTranscriptionUnavailable = true;
    },
    async upload(base64: string, mimeType: string, requestId: string = createRequestId()): Promise<VoiceReflectionResult> {
        if (!isSupabaseConfigured) {
            if (__DEV__) console.warn("[voice-reflection] Supabase is not configured in this build (missing EXPO_PUBLIC_SUPABASE_URL/key).");
            throw new Error("VOICE_UNAVAILABLE");
        }
        if (Math.ceil(base64.length / 4) * 3 > MAX_AUDIO_BYTES) throw new Error("VOICE_AUDIO_TOO_LARGE");
        const { data, error } = await supabase.functions.invoke("voice-reflection", {
            body: { audioBase64: base64, mimeType, requestId },
        });
        if (error) {
            logInvokeFailure(error);
            const code = await extractServerCode(error);
            throw new Error(code || "VOICE_UNAVAILABLE");
        }
        const result = data as VoiceReflectionResult | null;
        if (!result?.reflectionId) {
            if (__DEV__) console.warn("[voice-reflection] invoke succeeded without a reflectionId.");
            throw new Error("VOICE_UNAVAILABLE");
        }
        return result;
    },
    /**
     * Submit an on-device transcript as a reflection. Used only when server
     * STT is not configured: the audio was transcribed locally (no
     * third-party API) and the server persists it with honest on-device
     * metadata through the same idempotent pipeline as audio uploads.
     */
    async submitText(text: string, requestId: string = createRequestId()): Promise<VoiceReflectionResult> {
        if (!isSupabaseConfigured) {
            if (__DEV__) console.warn("[voice-reflection] Supabase is not configured in this build (missing EXPO_PUBLIC_SUPABASE_URL/key).");
            throw new Error("VOICE_UNAVAILABLE");
        }
        if (!text.trim()) throw new Error("EMPTY_TRANSCRIPTION");
        const { data, error } = await supabase.functions.invoke("voice-reflection", {
            body: { text, requestId },
        });
        if (error) {
            logInvokeFailure(error);
            const code = await extractServerCode(error);
            throw new Error(code || "VOICE_UNAVAILABLE");
        }
        const result = data as VoiceReflectionResult | null;
        if (!result?.reflectionId) {
            if (__DEV__) console.warn("[voice-reflection] invoke succeeded without a reflectionId.");
            throw new Error("VOICE_UNAVAILABLE");
        }
        return result;
    },
};
