import { memoriesRepository } from "@/repositories/memories.repository";
import { dataEvents } from "./dataEvents";

export const memoriesService = {
    listMemories: memoriesRepository.list,
    getMemory: memoriesRepository.get,
    listMemoryEvidence: memoriesRepository.listEvidence,
    async archiveMemory(id: string) {
        await memoriesRepository.archive(id);
        dataEvents.emit("memories");
    },
    async deleteMemory(id: string) {
        await memoriesRepository.delete(id);
        dataEvents.emit("memories");
    },
};
