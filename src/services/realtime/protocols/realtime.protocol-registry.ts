import type { RealtimeSessionProtocol, RealtimeSessionSpec } from "../types";
import { MirrorRealtimeError } from "../types";
import { OpenAIRealtimeProtocol } from "./openai-realtime.protocol";
import { GeminiLiveProtocol } from "./gemini-live.protocol";
import { SarvamPipelineProtocol } from "./sarvam-pipeline.protocol";

export function createRealtimeProtocol(spec: RealtimeSessionSpec): RealtimeSessionProtocol {
    switch (spec.protocol) {
        case "openai-realtime":
            return new OpenAIRealtimeProtocol(spec);
        case "gemini-live":
            return new GeminiLiveProtocol(spec);
        case "sarvam-pipeline":
            return new SarvamPipelineProtocol(spec);
        default:
            throw new MirrorRealtimeError("REALTIME_TRANSPORT_UNAVAILABLE", false, `No protocol mapper is available for "${spec.protocol}".`);
    }
}