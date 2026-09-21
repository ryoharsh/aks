import { supabase } from "@/lib/supabase";
import { copy } from "@/constants/copy";

export class DataRepositoryError extends Error {
    constructor(message: string = copy.errors.dataSummary) {
        super(message);
        this.name = "DataRepositoryError";
    }
}

export async function requireAuthenticatedUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
        throw new DataRepositoryError(copy.errors.writes.signInRequired);
    }
    return data.user;
}

export function throwDataError(error: unknown, message?: string): never {
    if (__DEV__) console.warn("Data repository error", error);
    throw new DataRepositoryError(message);
}
