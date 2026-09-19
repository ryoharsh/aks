import { createClient } from "npm:@supabase/supabase-js@2";

import { aiService } from "../_shared/ai/ai.service.ts";
import { createMemoryRepository } from "../_shared/memory/memory.repository.ts";
import { createPatternRepository } from "../_shared/pattern/pattern.repository.ts";
import { createReflectionRepository } from "../_shared/reflection/reflection.repository.ts";
import { processReflection } from "../_shared/reflection/reflection.service.ts";

const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
};

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_AUDIO_BYTES / 3) * 4;
const allowedMimeTypes = new Set(["audio/m4a", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/webm"]);

type ProcessingResult = {
    signalsSaved: number;
    signals: Array<{ signalType: string; value: Record<string, unknown>; confidence: number | null }>;
    memoryCandidates: Array<{ action: string; memoryId: string; status: string }>;
    patternActions: Array<{ action: string; patternId: string; status: string }>;
};

const emptyProcessing: ProcessingResult = { signalsSaved: 0, signals: [], memoryCandidates: [], patternActions: [] };

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers });
    if (request.method !== "POST") return respond({ error: { code: "METHOD_NOT_ALLOWED", message: "This request could not be processed." } }, 405);

    try {
        const authorization = request.headers.get("Authorization");
        const url = Deno.env.get("SUPABASE_URL");
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!authorization || !url || !anonKey || !serviceRoleKey) return respond({ error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } }, 401);

        const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
        const { data: { user }, error } = await userClient.auth.getUser();
        if (error || !user) return respond({ error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } }, 401);

        const body = await request.json().catch(() => null) as { audioBase64?: unknown; mimeType?: unknown; requestId?: unknown } | null;
        const audioBase64 = typeof body?.audioBase64 === "string" ? body.audioBase64 : "";
        const requestId = typeof body?.requestId === "string" ? body.requestId : "";
        const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "";
        if (!audioBase64 || !requestId || requestId.length > 100) {
            return respond({ error: { code: "INVALID_REQUEST", message: "This request could not be processed." } }, 400);
        }
        if (audioBase64.length > MAX_BASE64_LENGTH) return respond({ error: { code: "AUDIO_TOO_LARGE", message: "That recording is too long." } }, 413);
        if (!allowedMimeTypes.has(mimeType)) return respond({ error: { code: "UNSUPPORTED_AUDIO", message: "That recording format isn't supported." } }, 415);

        const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
        const reflectionRepository = createReflectionRepository(userClient, adminClient, user.id);
        const memoryRepository = createMemoryRepository(userClient, adminClient, user.id);
        const patternRepository = createPatternRepository(userClient, adminClient, user.id);

        // Idempotency: a retried upload returns the already-persisted reflection.
        const existing = await reflectionRepository.findByVoiceRequestId(user.id, requestId);
        if (existing) {
            const processing = await processReflection({ repository: reflectionRepository, memoryRepository, patternRepository, reflectionId: existing.id }).catch(() => emptyProcessing);
            return respond({ reflectionId: existing.id, createdAt: existing.createdAt, replayed: true, processing });
        }

        let audio: Uint8Array;
        try {
            const binary = atob(audioBase64);
            audio = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) audio[index] = binary.charCodeAt(index);
        } catch {
            return respond({ error: { code: "INVALID_REQUEST", message: "This request could not be processed." } }, 400);
        }
        if (audio.byteLength === 0 || audio.byteLength > MAX_AUDIO_BYTES) return respond({ error: { code: "AUDIO_TOO_LARGE", message: "That recording is too long." } }, 413);

        let transcription;
        try {
            transcription = await aiService.transcribe({ audio, mimeType });
        } catch (transcriptionError) {
            const code = transcriptionError instanceof Error ? transcriptionError.message : "";
            if (code === "TRANSCRIPTION_NOT_CONFIGURED") return respond({ error: { code: "TRANSCRIPTION_NOT_CONFIGURED", message: "Voice reflections aren't available on this build yet." } }, 503);
            if (code === "TRANSCRIPTION_TOO_LARGE") return respond({ error: { code: "AUDIO_TOO_LARGE", message: "That recording is too long." } }, 413);
            return respond({ error: { code: "TRANSCRIPTION_UNAVAILABLE", message: "Aks couldn't listen to that recording right now." } }, 503);
        }
        const text = transcription.text.trim();
        if (!text) return respond({ error: { code: "EMPTY_TRANSCRIPTION", message: "Aks couldn't hear anything in that recording." } }, 422);

        // The transcription is the raw reflection content; persistence happens
        // before any derived processing.
        const reflection = await reflectionRepository.saveReflection(text, {
            source: "voice_transcription",
            voice_request_id: requestId,
            transcription: { provider: transcription.provider, model: transcription.model, latency_ms: transcription.latencyMs },
        });

        // Derived processing is best-effort: the reflection is already saved.
        const processing = await processReflection({ repository: reflectionRepository, memoryRepository, patternRepository, reflectionId: reflection.id }).catch(() => emptyProcessing);

        return respond({ reflectionId: reflection.id, createdAt: reflection.createdAt, replayed: false, processing });
    } catch (error) {
        const code = error instanceof Error ? error.message : "";
        if (code === "REFLECTION_PERSISTENCE_FAILED") return respond({ error: { code, message: "We couldn't save that reflection. Please try again." } }, 503);
        return respond({ error: { code: "UNEXPECTED", message: "Something went wrong." } }, 500);
    }
});
