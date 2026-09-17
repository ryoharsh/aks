import { experimentsRepository } from "@/repositories/experiments.repository";
import { dataEvents } from "./dataEvents";

async function emitAfter<T>(operation: Promise<T>) {
    const result = await operation;
    dataEvents.emit("experiments");
    return result;
}

export const experimentsService = {
    listExperiments: experimentsRepository.list,
    getExperiment: experimentsRepository.get,
    listObservations: experimentsRepository.listObservations,
    createExperiment: (input: Parameters<typeof experimentsRepository.create>[0]) => emitAfter(experimentsRepository.create(input)),
    startExperiment: (id: string) => emitAfter(experimentsRepository.start(id)),
    recordObservation: (id: string, value: Parameters<typeof experimentsRepository.observe>[1], notes: string | null, requestId: string) => emitAfter(experimentsRepository.observe(id, value, notes, requestId)),
    completeExperiment: async (id: string) => { const result = await emitAfter(experimentsRepository.complete(id)); void experimentsRepository.retryLearning(id).then(() => { dataEvents.emit("experiments"); dataEvents.emit("learnings"); }).catch(() => undefined); return result; },
    retryAnalysis: async (id: string) => { const result = await emitAfter(experimentsRepository.retryAnalysis(id)); void experimentsRepository.retryLearning(id).then(() => { dataEvents.emit("experiments"); dataEvents.emit("learnings"); }).catch(() => undefined); return result; },
    retryLearning: async (id: string) => { const result = await emitAfter(experimentsRepository.retryLearning(id)); dataEvents.emit("learnings"); dataEvents.emit("insights"); return result; },
    retryInsight: async (id: string) => { const result = await emitAfter(experimentsRepository.retryInsight(id)); dataEvents.emit("insights"); return result; },
    cancelExperiment: (id: string) => emitAfter(experimentsRepository.cancel(id)),
    deleteExperiment: async (id: string) => { const result = await emitAfter(experimentsRepository.delete(id)); dataEvents.emit("learnings"); return result; },
};
