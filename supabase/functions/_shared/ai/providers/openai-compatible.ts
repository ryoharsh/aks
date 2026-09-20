import type { AIProvider, AIRequest, AIResult, TranscriptionRequest, TranscriptionResult } from "../types.ts";
import { AIProviderError } from "../types.ts";

type ProviderResponse = {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
};

type TranscriptionResponse = {
    text?: string;
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

    /**
     * Streaming chat completion (SSE). The conversation task returns a JSON
     * envelope (safety + response.text); the stream extractor below peeks at
     * the `safety.risk` value as soon as it is written and only then surfaces
     * incremental `response.text` content — so streaming never leaks content
     * that the safety layer might replace. The resolved result is the full
     * envelope, identical in shape to `generate`, and is validated by the
     * caller afterwards.
     */
    async generateStream(input: AIRequest, onDelta: (text: string) => void, signal?: AbortSignal): Promise<AIResult> {
        const startedAt = Date.now();
        const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: this.model,
                temperature: input.task === "conversation_response" ? 0.5 : 0.1,
                max_tokens: 500,
                stream: true,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: input.instructions },
                    { role: "user", content: JSON.stringify(input.context) },
                ],
            }),
        });
        if (!response.ok || !response.body) throw new AIProviderError("AI_PROVIDER_UNAVAILABLE");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffered = "";
        let sseCarry = "";
        let full = "";
        let safetyResolved = false;
        let riskImminent = false;
        let emittedForTurn = false;

        // Incremental JSON-string extractor: streams the value of the
        // "text" key (inside "response") while handling escape sequences.
        const consumeChunk = (delta: string) => {
            full += delta;
            if (!safetyResolved) {
                const riskMatch = /"risk"\s*:\s*"(imminent|none)"/.exec(full);
                if (riskMatch) {
                    safetyResolved = true;
                    riskImminent = riskMatch[1] === "imminent";
                }
                if (!safetyResolved && delta.includes("}")) {
                    // safety object malformed so far — wait for more content.
                }
            }
            if (!safetyResolved || riskImminent || !delta) return;
            // Find the text value start once.
            if (!emittedForTurn) {
                const textKeyIndex = full.indexOf('"text"');
                if (textKeyIndex === -1) return;
                const colonIndex = full.indexOf(":", textKeyIndex + 6);
                const quoteIndex = full.indexOf('"', colonIndex + 1);
                if (colonIndex === -1 || quoteIndex === -1) return;
                emittedForTurn = true;
                this.streamTextStart = quoteIndex + 1;
                this.streamEmitted = 0;
                this.streamDone = false;
                this.emitReadyText(onDelta, full);
                return;
            }
            this.emitReadyText(onDelta, full);
        };

        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                sseCarry += decoder.decode(value, { stream: true });
                const lines = sseCarry.split("\n");
                sseCarry = lines.pop() ?? "";
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith("data:")) continue;
                    const data = trimmed.slice(5).trim();
                    if (data === "[DONE]") continue;
                    try {
                        const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
                        const chunk = parsed.choices?.[0]?.delta?.content;
                        if (typeof chunk === "string" && chunk.length > 0) consumeChunk(chunk);
                    } catch {
                        // Malformed SSE line — skip, never crash the stream.
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        if (!full.trim()) throw new Error("AI_PROVIDER_INVALID_RESPONSE");
        return {
            content: full,
            provider: "openai-compatible",
            model: this.model,
            latencyMs: Date.now() - startedAt,
        };
    }

    private streamTextStart = 0;
    private streamEmitted = 0;
    private streamDone = false;

    private emitReadyText(onDelta: (text: string) => void, full: string) {
        if (this.streamDone) return;
        let cursor = this.streamTextStart + this.streamEmitted;
        let safeEnd = cursor;
        while (cursor < full.length) {
            const char = full[cursor];
            if (char === '"' && full[cursor - 1] !== "\\") {
                this.streamDone = true;
                break;
            }
            if (char === "\\") {
                // Wait until the escape pair is complete before emitting.
                if (cursor + 1 >= full.length) break;
                const escaped = full[cursor + 1];
                const decoded = escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped === '"' ? '"' : escaped === "\\" ? "\\" : null;
                if (decoded !== null) {
                    // Emit everything before the escape, then the decoded char.
                    if (safeEnd > this.streamTextStart + this.streamEmitted) {
                        onDelta(full.slice(this.streamTextStart + this.streamEmitted, cursor));
                    }
                    onDelta(decoded);
                    this.streamEmitted = cursor + 2 - this.streamTextStart;
                    cursor += 2;
                    safeEnd = cursor;
                    continue;
                }
            }
            cursor += 1;
        }
        if (!this.streamDone && safeEnd > this.streamTextStart + this.streamEmitted) {
            const pending = full.slice(this.streamTextStart + this.streamEmitted, safeEnd);
            if (/[^\u0000-\u001f]/.test(pending)) {
                onDelta(pending);
                this.streamEmitted += pending.length;
            }
        }
    }

    async transcribe(input: TranscriptionRequest): Promise<TranscriptionResult> {
        const transcriptionModel = Deno.env.get("AI_TRANSCRIBE_MODEL");
        if (!transcriptionModel) throw new Error("TRANSCRIPTION_NOT_CONFIGURED");

        const startedAt = Date.now();
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(input.audio)], { type: input.mimeType }), "audio");
        form.append("model", transcriptionModel);
        form.append("response_format", "json");
        const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/audio/transcriptions`, {
            method: "POST",
            signal: AbortSignal.timeout(60_000),
            headers: { Authorization: `Bearer ${this.apiKey}` },
            body: form,
        });
        if (!response.ok) throw new AIProviderError("AI_PROVIDER_UNAVAILABLE");
        const payload = await response.json() as TranscriptionResponse;
        const text = typeof payload.text === "string" ? payload.text.trim() : "";
        if (!text) throw new Error("AI_PROVIDER_INVALID_RESPONSE");
        if (text.length > 12000) throw new Error("TRANSCRIPTION_TOO_LARGE");

        return {
            text,
            provider: "openai-compatible",
            model: transcriptionModel,
            latencyMs: Date.now() - startedAt,
        };
    }
}
