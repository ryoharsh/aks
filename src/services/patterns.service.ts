import { patternsRepository } from "@/repositories/patterns.repository";
import { dataEvents } from "./dataEvents";

export const patternsService = {
    listPatterns: patternsRepository.list,
    getPattern: patternsRepository.get,
    listPatternEvidence: patternsRepository.listEvidence,
    async archivePattern(id: string) {
        await patternsRepository.archive(id);
        dataEvents.emit("patterns");
    },
    async deletePattern(id: string) {
        await patternsRepository.delete(id);
        dataEvents.emit("patterns");
    },
};
