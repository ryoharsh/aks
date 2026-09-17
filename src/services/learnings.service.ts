import { learningsRepository } from "@/repositories/learnings.repository";
import { dataEvents } from "./dataEvents";

export const learningsService = {
    listLearnings: learningsRepository.list,
    getLearning: learningsRepository.get,
    listLearningEvidence: learningsRepository.listEvidence,
    async archiveLearning(id: string) { await learningsRepository.archive(id); dataEvents.emit("learnings"); },
    async deleteLearning(id: string) { await learningsRepository.delete(id); dataEvents.emit("learnings"); },
};
