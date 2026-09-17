import { checkInsRepository } from "@/repositories/checkIns.repository";
import { dataEvents } from "./dataEvents";

export const checkInsService = {
    createCheckIn: async (...args: Parameters<typeof checkInsRepository.create>) => {
        const checkIn = await checkInsRepository.create(...args);
        dataEvents.emit("checkIns");
        return checkIn;
    },
    getCheckIn: checkInsRepository.get,
    listCheckIns: checkInsRepository.list,
};
