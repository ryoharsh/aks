import type { RealtimeSessionProtocol, RealtimeSessionSpec } from "../types";
import { MirrorRealtimeError } from "../types";
import { OpenAIRealtimeProtocol } from "./openai-realtime.protocol";

export function createRealtimeProtocol(spec: RealtimeSessionSpec): RealtimeSessionProtocol {
    switch (spec.protocol) {
        case "openai-realtime":
            return new OpenAIRealtimeProtocol(spec);
        default:
            throw new MirrorRealtimeError("REALTIME_TRANSPORT_UNAVAILABLE", false, `No protocol mapper is available for "${spec.protocol}".`);
    }
}