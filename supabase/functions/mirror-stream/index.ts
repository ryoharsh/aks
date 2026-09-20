// Streaming variant of the Mirror conversation turn.
// Reuses the SAME claim / context / validation / persistence machinery as the
// non-streaming `mirror` function (same ai_runs bookkeeping, same reply
// idempotency, same safety behavior). The only difference: the model response
// streams to the client as SSE deltas as soon as safe content is available,
// while the authoritative assistant message is persisted once, at the end.
//
// SSE events:
//   data: {"type":"delta","text":"..."}     — incremental response text
//   data: {"type":"done", ...MirrorFunctionResponse}
//   data: {"type":"error","code":"..."}     — recoverable failure (client falls back)

import { createClient } from "npm:@supabase/supabase-js@2";

import { aiService } from "../_shared/ai/ai.service.ts";
import { isPolicyBlockedError } from "../_shared/ai/types.ts";
import { buildMirrorContext } from "../_shared/mirror/context.ts";
import { crisisResponse, requiresCrisisResponse } from "../_shared/mirror/safety.ts";
import { createMirrorRepository } from "../_shared/mirror/mirror.repository.ts";
import { conversationResponseTask } from "../_shared/mirror/prompts.ts";
import { validateConversationResponse } from "../_shared/mirror/validation.ts";
import { relevantSourcesForMessage } from "../_shared/mirror/mirror.core.ts";

const headers = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "Access-Control-Allow-Origin": "*" };
const jsonHeaders = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sse(controller: ReadableStreamDefaultWriter<Uint8Array>, payload: unknown) {
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`));
}

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: { ...headers, "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
    if (request.method !== "POST") return respond({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } }, 405);

    try {
        const authorization = request.headers.get("Authorization");
        const url = Deno.env.get("SUPABASE_URL");
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!authorization || !url || !anonKey || !serviceRoleKey) return respond({ error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } }, 401);

        let body: { conversationId?: unknown; userMessageId?: unknown };
        try {
            body = await request.json();
        } catch {
            return respond({ error: { code: "INVALID_REQUEST", message: "The message could not be processed." } }, 400);
        }
        if (typeof body.conversationId !== "string" || typeof body.userMessageId !== "string" || !uuidPattern.test(body.conversationId) || !uuidPattern.test(body.userMessageId)) {
            return respond({ error: { code: "INVALID_REQUEST", message: "The message could not be processed." } }, 400);
        }

        const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
        const { data: { user }, error } = await userClient.auth.getUser();
        if (error || !user) return respond({ error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } }, 401);

        const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
        const repository = createMirrorRepository(userClient, adminClient, user.id);

        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                let runId: string | null = null;
                try {
                    const conversation = await repository.getConversation(body.conversationId!);
                    const userMessage = await repository.getUserMessage(body.conversationId!, body.userMessageId!);
                    if (userMessage.content.length > 12000) throw new Error("MESSAGE_TOO_LARGE");

                    const existingReply = await repository.findAssistantReply(body.conversationId!, body.userMessageId!);
                    if (existingReply) {
                        await repository.reconcileAIRun(body.userMessageId!, conversationResponseTask.task).catch(() => undefined);
                        const safetyResponse = existingReply.metadata.task_version === "safety_response_v1";
                        sse(controller, {
                            type: "done",
                            conversationId: body.conversationId,
                            response: { response: { text: typeof existingReply.metadata.response_text === "string" ? existingReply.metadata.response_text : existingReply.content }, followUp: typeof existingReply.metadata.follow_up === "string" ? existingReply.metadata.follow_up : null },
                            assistantMessage: existingReply,
                            observable: !safetyResponse,
                        });
                        controller.close();
                        return;
                    }

                    if (requiresCrisisResponse(userMessage.content)) {
                        const assistantMessage = await repository.saveAssistant({ conversationId: body.conversationId!, userMessageId: body.userMessageId!, content: crisisResponse, responseText: crisisResponse, followUp: null, taskVersion: "safety_response_v1" });
                        sse(controller, { type: "delta", text: crisisResponse });
                        sse(controller, { type: "done", conversationId: body.conversationId, response: { response: { text: crisisResponse }, followUp: null }, assistantMessage, observable: false });
                        controller.close();
                        return;
                    }

                    const claim = await repository.claimAIRun({ conversationId: body.conversationId!, userMessageId: body.userMessageId!, task: conversationResponseTask.task });
                    if (claim.status === "succeeded") {
                        sse(controller, { type: "error", code: "ATTEMPTS_EXHAUSTED" });
                        controller.close();
                        return;
                    }
                    runId = claim.id;

                    const [recentMessages, recentSignals, activeMemories, supportedPatterns, activeExperiments, relevantLearnings, preferences, contextBundle] = await Promise.all([
                        repository.getRecentMessages(body.conversationId!, { createdAt: userMessage.createdAt, id: userMessage.id }),
                        repository.getRecentSignals(userMessage.createdAt),
                        repository.getActiveMemories(),
                        repository.getSupportedPatterns(),
                        repository.getActiveExperiments(),
                        repository.getRelevantLearnings(),
                        repository.getPreferences(),
                        repository.getContextBundle(userMessage.createdAt, 6, 8, relevantSourcesForMessage(userMessage.content)),
                    ]);
                    const context = buildMirrorContext({ currentMessage: userMessage.content, conversation: { title: conversation.title }, recentMessages, recentSignals, activeMemories, supportedPatterns, activeExperiments, relevantLearnings, preferences, contextSources: contextBundle.connectedSources, relevantObservations: contextBundle.observations.slice(0, 8) });

                    let streamedText = "";
                    const result = await aiService.generateStream!(
                        {
                            task: conversationResponseTask.task,
                            version: conversationResponseTask.version,
                            instructions: conversationResponseTask.instructions,
                            context,
                        },
                        (text) => {
                            streamedText += text;
                            sse(controller, { type: "delta", text });
                        },
                    );

                    // The provider stream surfaces the safety field before text;
                    // verify here for the crisis-replacement path.
                    let validated: { safety: { risk: string }; response: { text: string }; followUp: string | null };
                    try {
                        validated = validateConversationResponse(result.content) as typeof validated;
                    } catch {
                        throw new Error("INVALID_AI_RESPONSE");
                    }
                    const riskImminent = validated.safety.risk === "imminent";
                    let finalText = validated.response.text;
                    let observable = true;
                    if (riskImminent) {
                        streamedText = "";
                        finalText = crisisResponse;
                        observable = false;
                    }

                    const assistantMessage = await (async () => {
                        try {
                            return await repository.saveAssistant({ conversationId: body.conversationId!, userMessageId: body.userMessageId!, content: finalText, responseText: finalText, followUp: validated.followUp, taskVersion: conversationResponseTask.version });
                        } catch {
                            const existing = await repository.findAssistantReply(body.conversationId!, body.userMessageId!);
                            if (!existing) throw new Error("ASSISTANT_PERSISTENCE_FAILED");
                            return existing;
                        }
                    })();

                    await repository.updateAIRun(runId!, {
                        status: "succeeded",
                        completed_at: new Date().toISOString(),
                    }).catch(() => undefined);

                    // If the safety replacement happened, correct the client's
                    // streamed text with the authoritative content.
                    if (riskImminent) sse(controller, { type: "delta", text: crisisResponse, replace: true });
                    sse(controller, {
                        type: "done",
                        conversationId: body.conversationId,
                        response: { response: { text: finalText }, followUp: validated.followUp },
                        assistantMessage,
                        observable,
                    });
                    controller.close();
                } catch (error) {
                    const message = error instanceof Error ? error.message : "";
                    const code = message === "INVALID_AI_RESPONSE" ? "INVALID_AI_OUTPUT" : message.startsWith("RATE_LIMITED") ? "RATE_LIMITED" : isPolicyBlockedError(error) ? "POLICY_BLOCKED" : message === "MESSAGE_TOO_LARGE" ? "MESSAGE_TOO_LARGE" : "AI_UNAVAILABLE";
                    if (runId) {
                        await repository.updateAIRun(runId, { status: "failed", error_code: message.slice(0, 80) || code, completed_at: new Date().toISOString() }).catch(() => undefined);
                    }
                    try {
                        sse(controller, { type: "error", code });
                        controller.close();
                    } catch {
                        // Client already gone.
                    }
                }
            },
        });

        return new Response(stream, { headers });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message === "ATTEMPTS_EXHAUSTED") return respond({ error: { code: "ATTEMPTS_EXHAUSTED", message: "This response can no longer be retried." } }, 409);
        if (message === "RATE_LIMITED") return respond({ error: { code: "RATE_LIMITED", message: "Please wait a moment before trying again." } }, 429);
        if (message === "MESSAGE_TOO_LARGE") return respond({ error: { code: "INVALID_REQUEST", message: "That message is too long." } }, 400);
        if (["CONVERSATION_UNAVAILABLE", "MESSAGE_UNAVAILABLE"].includes(message)) return respond({ error: { code: "NOT_FOUND", message: "This conversation is unavailable." } }, 404);
        return respond({ error: { code: "AI_UNAVAILABLE", message: "Aks couldn't process that right now." } }, 503);
    }
});
