import { insightsRepository } from "@/repositories/insights.repository";
import { dataEvents } from "./dataEvents";

async function emitAfter(operation: Promise<void>) { await operation; dataEvents.emit("insights"); }
export const insightsService = {
    listInsights: insightsRepository.list,
    getInsight: insightsRepository.get,
    getInsightSources: insightsRepository.getSources,
    markSeen: (id: string) => emitAfter(insightsRepository.markSeen(id)),
    dismissInsight: (id: string) => emitAfter(insightsRepository.dismiss(id)),
    archiveInsight: (id: string) => emitAfter(insightsRepository.archive(id)),
    deleteInsight: (id: string) => emitAfter(insightsRepository.delete(id)),
};
