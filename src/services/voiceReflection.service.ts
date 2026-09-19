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

export const voiceReflectionService = {
    async upload(base64: string, mimeType: string, requestId: string = createRequestId()): Promise<VoiceReflectionResult> {
        if (!isSupabaseConfigured) throw new Error("VOICE_UNAVAILABLE");
        if (Math.ceil(base64.length / 4) * 3 > MAX_AUDIO_BYTES) throw new Error("VOICE_AUDIO_TOO_LARGE");
        const { data, error } = await supabase.functions.invoke("voice-reflection", {
            body: { audioBase64: base64, mimeType, requestId },
        });
        if (error) {
            const context = (error as { context?: Response }).context;
            if (context) {
                try {
                    const payload = await context.clone().json() as { error?: { code?: string } };
                    throw new Error(payload.error?.code ?? "VOICE_UNAVAILABLE");
                } catch (parseError) {
                    if (parseError instanceof Error && parseError.message && !/expected|json/i.test(parseError.message)) throw parseError;
                }
            }
            throw new Error("VOICE_UNAVAILABLE");
        }
        const result = data as VoiceReflectionResult | null;
        if (!result?.reflectionId) throw new Error("VOICE_UNAVAILABLE");
        return result;
    },
};
