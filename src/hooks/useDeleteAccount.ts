import { useCallback, useState } from "react";

import { privacyService } from "@/services/privacy.service";

type DeleteDataState = {
    deleting: boolean;
    deleted: boolean;
    error: string | null;
    deleteAccount: () => Promise<void>;
};

export function useDeleteAccount(): DeleteDataState {
    const [deleting, setDeleting] = useState(false);
    const [deleted, setDeleted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const deleteAccount = useCallback(async () => {
        setDeleting(true);
        setError(null);
        try {
            await privacyService.deleteAccount();
            setDeleted(true);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Account deletion is not available right now. Please try again later.");
        } finally {
            setDeleting(false);
        }
    }, []);

    return { deleting, deleted, error, deleteAccount };
}