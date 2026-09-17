import { supabase } from "@/lib/supabase";

export class DataRepositoryError extends Error {
    constructor(message = "We couldn't load your data. Please try again.") {
        super(message);
        this.name = "DataRepositoryError";
    }
}

export async function requireAuthenticatedUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
        throw new DataRepositoryError("Please sign in to continue.");
    }
    return data.user;
}

export function throwDataError(error: unknown, message?: string): never {
    if (__DEV__) console.warn("Data repository error", error);
    throw new DataRepositoryError(message);
}
