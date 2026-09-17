import { reflectionsRepository } from "@/repositories/reflections.repository";
import { dataEvents } from "./dataEvents";

export const reflectionsService = {
    createReflection: async (...args: Parameters<typeof reflectionsRepository.create>) => {
        const reflection = await reflectionsRepository.create(...args);
        dataEvents.emit("reflections");
        return reflection;
    },
    getReflection: reflectionsRepository.get,
    listReflections: reflectionsRepository.list,
};
