import type { AIProvider, AIRequest, AIResult, AITask, TranscriptionRequest, TranscriptionResult } from "../types.ts";
import { AIProviderError } from "../types.ts";
import { resolveSTTConfig } from "./provider.config.ts";

type ProviderResponse = {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
};

type StreamChunk = {
    choices?: Array<{ delta?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
};

type TranscriptionResponse = {
    text?: string;
};

/** Per-task request timeout. Long analysis tasks get more room than extraction. */
const taskTimeoutMs: Record<AITask, number> = {
    conversation_response: 30_000,
    signal_extraction: 10_000,
    memory_evaluation: 20_000,
    pattern_analysis: 20_000,
    experiment_analysis: 20_000,
    learning_synthesis: 20_000,
    insight_generation: 20_000,
    reflection_transcription: 60_000,
};

/**
 * Wall-clock ceiling for one logical generation, retries included. Retries are
 * bounded (48.3): never more than one extra attempt, never past this budget,
 * and never after content has already reached the client.
 */
const generationBudgetMs = 50_000;
const maxAttempts = 2;
const baseBackoffMs = 500;
const maxBackoffMs = 4_000;

const retryableStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504, 522, 524]);

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A timeout signal that can also be cancelled by an external signal (a client
 * disconnecting, for example). Aborting with a TimeoutError-named reason keeps
 * the same classification `AbortSignal.timeout` produces, so the callers can
 * tell "the provider was too slow" apart from "the client went away".
 */
function deadlineSignal(timeoutMs: number, external?: AbortSignal): AbortSignal {
    if (external && typeof AbortSignal.any === "function") return AbortSignal.any([external, AbortSignal.timeout(timeoutMs)]);
    if (!external) return AbortSignal.timeout(timeoutMs);
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort(new DOMException("The operation timed out.", "TimeoutError"));
    }, timeoutMs);
    const forward = () => controller.abort(external.reason);
    if (external.aborted) forward();
    else external.addEventListener("abort", forward, { once: true });
    controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
    return controller.signal;
}

function retryAfterMs(response: Response): number | null {
    const header = response.headers.get("retry-after");
    if (!header) return null;
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, maxBackoffMs);
    const date = Number.isFinite(Date.parse(header)) ? Date.parse(header) : Number.NaN;
    if (Number.isNaN(date)) return null;
    return Math.min(Math.max(date - Date.now(), 0), maxBackoffMs);
}

function backoffDelayMs(attempt: number) {
    const exponential = Math.min(baseBackoffMs * 2 ** (attempt - 1), maxBackoffMs);
    return exponential + Math.floor(Math.random() * exponential);
}

const policyBlockedDetail = /content.polic|moderation|safety.system|safety.?policy|prompt.?blocked/;

async function readFailureDetail(response: Response): Promise<{ detail: string | null; policyBlocked: boolean }> {
    let detail = "";
    try {
        const text = (await response.text()).trim();
        if (text) {
            try {
                const body = JSON.parse(text) as { error?: { type?: string; message?: string } };
                detail = [body?.error?.type, body?.error?.message].filter(Boolean).join(": ");
            } catch {
                detail = text;
            }
        }
    } catch {
        // Body already consumed or unreadable — the status code still classifies the failure.
    }
    const trimmed = detail.slice(0, 300);
    return { detail: trimmed || null, policyBlocked: policyBlockedDetail.test(trimmed.toLowerCase()) };
}

/**
 * Incremental extractor for the conversation task's JSON envelope. It streams
 * the value of `response.text` only after `safety.risk` proves the turn is not
 * an imminent-risk turn, decoding JSON escapes as they complete so accents and
 * newlines never stall the visible stream.
 */
function createResponseTextExtractor(emit: (text: string) => void) {
    let full = "";
    let safetyResolved = false;
    let riskImminent = false;
    let textStart: number | null = null;
    let emitted = 0;
    let done = false;

    const emitReady = () => {
        if (textStart === null || done) return;
        let cursor = textStart + emitted;
        let chunk = "";
        while (cursor < full.length) {
            const char = full[cursor];
            if (char === "\\") {
                if (cursor + 1 >= full.length) break;
                const escaped = full[cursor + 1];
                const simple = escaped === "n" ? "\n"
                    : escaped === "t" ? "\t"
                    : escaped === "r" ? "\r"
                    : escaped === "b" ? "\b"
                    : escaped === "f" ? "\f"
                    : escaped === '"' ? '"'
                    : escaped === "/" ? "/"
                    : escaped === "\\" ? "\\"
                    : null;
                if (simple !== null) {
                    chunk += simple;
                    cursor += 2;
                    continue;
                }
                if (escaped === "u") {
                    const hex = full.slice(cursor + 2, cursor + 6);
                    if (hex.length < 4) break;
                    try {
                        chunk += JSON.parse(`"\\u${hex}"`) as string;
                    } catch {
                        break;
                    }
                    cursor += 6;
                    continue;
                }
                break;
            }
            if (char === '"') {
                done = true;
                break;
            }
            chunk += char;
            cursor += 1;
        }
        emitted = cursor - textStart;
        if (chunk) emit(chunk);
    };

    return {
        consume(delta: string) {
            full += delta;
            if (!safetyResolved) {
                const riskMatch = /"risk"\s*:\s*"(imminent|none)"/.exec(full);
                if (riskMatch) {
                    safetyResolved = true;
                    riskImminent = riskMatch[1] === "imminent";
                }
            }
            if (!safetyResolved || riskImminent) return;
            if (textStart === null) {
                const keyIndex = full.indexOf('"text"');
                if (keyIndex === -1) return;
                const colonIndex = full.indexOf(":", keyIndex + 6);
                if (colonIndex === -1) return;
                const quoteIndex = full.indexOf('"', colonIndex + 1);
                if (quoteIndex === -1) return;
                textStart = quoteIndex + 1;
            }
            emitReady();
        },
        finish() {
            if (safetyResolved && !riskImminent) emitReady();
        },
    };
}

export class OpenAICompatibleProvider implements AIProvider {
    constructor(
        private readonly baseUrl: string,
        private readonly apiKey: string,
        private readonly model: string,
    ) {}

    private endpoint(path: string) {
        return `${this.baseUrl.replace(/\/$/, "")}${path}`;
    }

    private requestBody(input: AIRequest, stream: boolean) {
        return JSON.stringify({
            model: this.model,
            temperature: input.task === "conversation_response" ? 0.5 : input.task === "signal_extraction" ? 0.1 : 0.2,
            max_tokens: input.task === "signal_extraction" ? 300 : input.task === "pattern_analysis" ? 700 : 500,
            ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: input.instructions },
                { role: "user", content: JSON.stringify(input.context) },
            ],
        });
    }

    private async failureFrom(response: Response) {
        const { detail, policyBlocked } = await readFailureDetail(response);
        return new AIProviderError("AI_PROVIDER_UNAVAILABLE", policyBlocked, {
            status: response.status,
            // A policy rejection is deterministic: retrying wastes an attempt on
            // content that will be refused again.
            retryable: !policyBlocked && retryableStatuses.has(response.status),
            retryAfterMs: retryAfterMs(response),
            detail,
        });
    }

    private normalizeError(error: unknown): AIProviderError {
        if (error instanceof AIProviderError) return error;
        const name = error instanceof Error ? error.name : "";
        if (name === "TimeoutError") {
            return new AIProviderError("AI_PROVIDER_TIMEOUT", false, { retryable: true, detail: "request timed out" });
        }
        if (name === "AbortError") {
            return new AIProviderError("AI_PROVIDER_ABORTED", false, { retryable: false, detail: "request aborted" });
        }
        return new AIProviderError("AI_PROVIDER_UNAVAILABLE", false, {
            retryable: true,
            detail: error instanceof Error ? error.message.slice(0, 200) : null,
        });
    }

    private async waitBeforeRetry(error: AIProviderError, attempt: number, startedAt: number) {
        const waitMs = Math.max(error.retryAfterMs ?? backoffDelayMs(attempt), 0);
        if (Date.now() - startedAt + waitMs >= generationBudgetMs) return false;
        await delay(waitMs);
        return true;
    }

    async generate(input: AIRequest): Promise<AIResult> {
        const startedAt = Date.now();
        const timeoutMs = taskTimeoutMs[input.task] ?? 30_000;
        let attempt = 0;
        for (;;) {
            attempt += 1;
            const remaining = generationBudgetMs - (Date.now() - startedAt);
            if (remaining <= 0) {
                throw new AIProviderError("AI_PROVIDER_TIMEOUT", false, { detail: "generation budget exhausted" });
            }
            try {
                return await this.generateOnce(input, startedAt, Math.min(timeoutMs, remaining));
            } catch (error) {
                const normalized = this.normalizeError(error);
                if (!normalized.retryable || attempt >= maxAttempts) throw normalized;
                if (!(await this.waitBeforeRetry(normalized, attempt, startedAt))) throw normalized;
            }
        }
    }

    private async generateOnce(input: AIRequest, startedAt: number, timeoutMs: number): Promise<AIResult> {
        const response = await fetch(this.endpoint("/chat/completions"), {
            method: "POST",
            signal: AbortSignal.timeout(timeoutMs),
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            },
            body: this.requestBody(input, false),
        });

        if (!response.ok) throw await this.failureFrom(response);
        const payload = await response.json() as ProviderResponse;
        const content = payload.choices?.[0]?.message?.content;
        if (!content || !content.trim()) {
            // An empty completion is transient; the caller still validates whatever
            // we return, so this is the one failure that may safely be re-attempted.
            throw new AIProviderError("AI_PROVIDER_INVALID_RESPONSE", false, { status: response.status, retryable: true, detail: "empty completion" });
        }

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
     * Streaming chat completion (SSE). Shares the retry/error contract with
     * `generate`, with one extra rule: once a delta has reached the caller the
     * attempt can never be replayed, because a second stream would duplicate or
     * contradict text the user has already seen. All extractor state is local to
     * the call, so one provider instance can serve concurrent streams.
     */
    async generateStream(input: AIRequest, onDelta: (text: string) => void, signal?: AbortSignal): Promise<AIResult> {
        const startedAt = Date.now();
        const timeoutMs = taskTimeoutMs[input.task] ?? 30_000;
        let attempt = 0;
        for (;;) {
            attempt += 1;
            const remaining = generationBudgetMs - (Date.now() - startedAt);
            if (remaining <= 0) {
                throw new AIProviderError("AI_PROVIDER_TIMEOUT", false, { detail: "generation budget exhausted" });
            }
            let emitted = false;
            try {
                return await this.streamOnce(
                    input,
                    (text) => {
                        emitted = true;
                        onDelta(text);
                    },
                    signal,
                    Math.min(timeoutMs, remaining),
                    startedAt,
                );
            } catch (error) {
                const normalized = this.normalizeError(error);
                if (emitted || !normalized.retryable || attempt >= maxAttempts) throw normalized;
                if (!(await this.waitBeforeRetry(normalized, attempt, startedAt))) throw normalized;
            }
        }
    }

    private async streamOnce(
        input: AIRequest,
        emit: (text: string) => void,
        signal: AbortSignal | undefined,
        timeoutMs: number,
        startedAt: number,
    ): Promise<AIResult> {
        const response = await fetch(this.endpoint("/chat/completions"), {
            method: "POST",
            signal: deadlineSignal(timeoutMs, signal),
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            },
            body: this.requestBody(input, true),
        });
        if (!response.ok) throw await this.failureFrom(response);
        if (!response.body) {
            throw new AIProviderError("AI_PROVIDER_UNAVAILABLE", false, { status: response.status, retryable: true, detail: "missing response body" });
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const extractor = createResponseTextExtractor(emit);
        let full = "";
        let sseCarry = "";
        let usage: ProviderResponse["usage"];

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
                    if (!data || data === "[DONE]") continue;
                    try {
                        const parsed = JSON.parse(data) as StreamChunk;
                        if (parsed.usage) usage = parsed.usage;
                        const chunk = parsed.choices?.[0]?.delta?.content;
                        if (typeof chunk === "string" && chunk.length > 0) {
                            full += chunk;
                            extractor.consume(chunk);
                        }
                    } catch {
                        // Malformed SSE line — skip, never crash the stream.
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
        extractor.finish();

        if (!full.trim()) throw new AIProviderError("AI_PROVIDER_INVALID_RESPONSE", false, { retryable: true, detail: "empty stream" });
        return {
            content: full,
            provider: "openai-compatible",
            model: this.model,
            latencyMs: Date.now() - startedAt,
            usage: {
                inputTokens: usage?.prompt_tokens,
                outputTokens: usage?.completion_tokens,
            },
        };
    }

    async transcribe(input: TranscriptionRequest): Promise<TranscriptionResult> {
        // Model selection lives in provider.config (AI_STT_MODEL). An
        // explicit model stays required on
        // this path — it never silently defaults to a billed model.
        const transcriptionModel = resolveSTTConfig().model;
        if (!transcriptionModel) throw new Error("TRANSCRIPTION_NOT_CONFIGURED");

        const startedAt = Date.now();
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(input.audio)], { type: input.mimeType }), "audio");
        form.append("model", transcriptionModel);
        form.append("response_format", "json");
        const response = await fetch(this.endpoint("/audio/transcriptions"), {
            method: "POST",
            signal: AbortSignal.timeout(60_000),
            headers: { Authorization: `Bearer ${this.apiKey}` },
            body: form,
        });
        if (!response.ok) {
            if (retryableStatuses.has(response.status)) {
                const { detail } = await readFailureDetail(response);
                throw new AIProviderError("AI_PROVIDER_UNAVAILABLE", false, { status: response.status, retryable: true, retryAfterMs: retryAfterMs(response), detail });
            }
            throw new AIProviderError("AI_PROVIDER_UNAVAILABLE");
        }
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
