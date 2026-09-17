import { privacyService } from "@/services/privacy.service";

export const accountService = {
    requestDeletion: privacyService.requestAccountDeletion,
};