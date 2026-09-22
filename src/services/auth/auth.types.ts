export type AuthProviderName = "google" | "github" | "facebook";

export type AuthErrorType =
    | "INVALID_EMAIL"
    | "EMAIL_ALREADY_REGISTERED"
    | "NETWORK_ERROR"
    | "OAUTH_CANCELLED"
    | "NOT_CONFIGURED"
    | "REVIEWER_NOT_CONFIGURED"
    | "WEB_CRYPTO_UNAVAILABLE"
    | "UNKNOWN";

export class AuthError extends Error {
    constructor(
        public readonly type: AuthErrorType,
        message: string,
    ) {
        super(message);
        this.name = "AuthError";
    }
}

export type AksUser = {
    id: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
    provider: string | null;
    createdAt: string;
};
