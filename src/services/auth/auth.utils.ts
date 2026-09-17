import type { User } from "@supabase/supabase-js";

import { AuthError, type AksUser } from "./auth.types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!emailPattern.test(normalized)) {
        throw new AuthError("INVALID_EMAIL", "Invalid email address.");
    }
    return normalized;
}

export function normalizeName(name: string) {
    const normalized = name.trim();
    if (normalized.length < 2) {
        throw new AuthError("UNKNOWN", "Please enter your full name.");
    }
    return normalized;
}

export function normalizeAuthError(error: unknown): AuthError {
    if (error instanceof AuthError) return error;

    const candidate = error as { code?: string; message?: string; status?: number };
    const code = candidate?.code?.toLowerCase() ?? "";
    const message = candidate?.message?.toLowerCase() ?? "";

    if (code.includes("email") || message.includes("invalid email")) {
        return new AuthError("INVALID_EMAIL", "Invalid email address.");
    }
    if (code.includes("already") || message.includes("already registered")) {
        return new AuthError("EMAIL_ALREADY_REGISTERED", "That email is already registered. Try signing in instead.");
    }
    if (message.includes("network") || message.includes("fetch") || candidate?.status === 0) {
        return new AuthError("NETWORK_ERROR", "Check your connection and try again.");
    }
    return new AuthError("UNKNOWN", "We couldn't complete that request. Please try again.");
}

export function toAksUser(user: User | null): AksUser | null {
    if (!user) return null;
    return {
        id: user.id,
        email: user.email ?? null,
        name:
            (user.user_metadata.full_name as string | undefined) ??
            (user.user_metadata.name as string | undefined) ??
            null,
        avatarUrl:
            (user.user_metadata.avatar_url as string | undefined) ??
            (user.user_metadata.picture as string | undefined) ??
            null,
        provider: user.app_metadata.provider ?? null,
        createdAt: user.created_at,
    };
}
