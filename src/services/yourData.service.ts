import { dataCountsRepository } from "@/repositories/dataCounts.repository";

export const yourDataService = {
    getCounts: dataCountsRepository.get,
};
