import { createClient } from "npm:@supabase/supabase-js@2";

import { aiService } from "../_shared/ai/ai.service.ts";
import { createExperimentRepository } from "../_shared/experiment/experiment.repository.ts";
import { createExperimentService } from "../_shared/experiment/experiment.service.ts";
import { createLearningRepository } from "../_shared/learning/learning.repository.ts";
import { createLearningService } from "../_shared/learning/learning.service.ts";
import { createInsightRepository } from "../_shared/insight/insight.repository.ts";
import { createInsightService } from "../_shared/insight/insight.service.ts";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers });
    if (request.method !== "POST") return respond({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } }, 405);
    try {
        const authorization = request.headers.get("Authorization");
        const url = Deno.env.get("SUPABASE_URL");
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!authorization || !url || !anonKey || !serviceRoleKey) return respond({ error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } }, 401);
        const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
        const { data: { user }, error } = await userClient.auth.getUser();
        if (error || !user) return respond({ error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } }, 401);
        const body = await request.json() as Record<string, unknown>;
        if (typeof body.action !== "string") return respond({ error: { code: "INVALID_REQUEST", message: "Invalid experiment request." } }, 400);
        const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
        const experimentRepository = createExperimentRepository(userClient, adminClient, user.id);
        const service = createExperimentService(experimentRepository, aiService);
        const learningService = createLearningService(createLearningRepository(userClient, adminClient, user.id), aiService);
        const insightService = createInsightService(createInsightRepository(userClient, adminClient, user.id), aiService);
        if (body.action === "create") {
            if (typeof body.patternId !== "string" || !uuid.test(body.patternId)) throw new Error("INVALID_EXPERIMENT");
            return respond(await service.createDraft({ patternId: body.patternId, title: body.title, hypothesis: body.hypothesis, description: body.description, durationDays: body.durationDays }));
        }
        if (typeof body.experimentId !== "string" || !uuid.test(body.experimentId)) throw new Error("INVALID_EXPERIMENT");
        if (body.action === "start") return respond(await service.start(body.experimentId));
        if (body.action === "observe") return respond(await service.recordObservation({ experimentId: body.experimentId, value: body.value, notes: body.notes, requestId: typeof body.requestId === "string" ? body.requestId : "" }));
        if (body.action === "complete") return respond(await service.complete(body.experimentId));
        if (body.action === "retry_analysis") return respond(await service.retryAnalysis(body.experimentId));
        if (body.action === "retry_learning") { await learningService.synthesize(body.experimentId); await insightService.generate(body.experimentId).catch(() => undefined); return respond(await experimentRepository.getExperiment(body.experimentId)); }
        if (body.action === "retry_insight") { await insightService.generate(body.experimentId); return respond(await experimentRepository.getExperiment(body.experimentId)); }
        if (body.action === "cancel") return respond(await service.cancel(body.experimentId));
        if (body.action === "delete") { await service.delete(body.experimentId); return respond({ deleted: true }); }
        return respond({ error: { code: "INVALID_REQUEST", message: "Invalid experiment action." } }, 400);
    } catch (error) {
        const code = error instanceof Error ? error.message : "EXPERIMENT_UNAVAILABLE";
        const status = code.startsWith("INVALID") || code === "UNSAFE_EXPERIMENT" ? 400 : code.includes("UNAVAILABLE") ? 404 : 409;
        return respond({ error: { code, message: code === "UNSAFE_EXPERIMENT" ? "This experiment is not safe to create." : "Aks couldn't update this experiment right now." } }, status);
    }
});
