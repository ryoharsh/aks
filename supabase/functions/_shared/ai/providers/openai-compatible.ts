import type { AIProvider, AIRequest, AIResult } from "../types.ts";
import { AIProviderError } from "../types.ts";

type ProviderResponse = {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export class OpenAICompatibleProvider implements AIProvider {
    constructor(
        private readonly baseUrl: string,
        private readonly apiKey: string,
        private readonly model: string,
    ) {}

    async generate(input: AIRequest): Promise<AIResult> {
        const startedAt = Date.now();
        const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            signal: AbortSignal.timeout(input.task === "signal_extraction" ? 10_000 : input.task === "memory_evaluation" || input.task === "pattern_analysis" || input.task === "experiment_analysis" || input.task === "learning_synthesis" || input.task === "insight_generation" ? 20_000 : 30_000),
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: this.model,
                temperature: input.task === "conversation_response" ? 0.5 : input.task === "memory_evaluation" || input.task === "pattern_analysis" || input.task === "experiment_analysis" || input.task === "learning_synthesis" || input.task === "insight_generation" ? 0.2 : 0.1,
                max_tokens: input.task === "signal_extraction" ? 300 : input.task === "pattern_analysis" ? 700 : 500,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: input.instructions },
                    { role: "user", content: JSON.stringify(input.context) },
                ],
            }),
        });

        if (!response.ok) {
            let policyBlocked = false;
            try {
                const body = await response.json() as { error?: { type?: string; message?: string } };
                const detail = `${body?.error?.type ?? ""} ${body?.error?.message ?? ""}`.toLowerCase();
                policyBlocked = /content.polic|moderation|safety.system|safety.?policy|prompt.?blocked/.test(detail);
            } catch {
                policyBlocked = false;
            }
            throw new AIProviderError("AI_PROVIDER_UNAVAILABLE", policyBlocked);
        }
        const payload = await response.json() as ProviderResponse;
        const content = payload.choices?.[0]?.message?.content;
        if (!content) throw new Error("AI_PROVIDER_INVALID_RESPONSE");

        return {
            content,
            provider: "openai-compatible",
            model: this.model,
            latencyMs: Date.now() - startedAt,
            usage: {
                inputTokens: payload.usage?.prompt_tokens,
                outputTokens: payload.usage?.completion_tokens,
            },
        };
    }
}
