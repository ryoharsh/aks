import { signalsRepository } from "@/repositories/signals.repository";
import { dataEvents } from "./dataEvents";

export const signalsService = {
    createSignal: async (...args: Parameters<typeof signalsRepository.create>) => {
        const signal = await signalsRepository.create(...args);
        dataEvents.emit("signals");
        return signal;
    },
    getSignal: signalsRepository.get,
    listSignals: signalsRepository.list,
};
