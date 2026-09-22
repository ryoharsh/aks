/**
 * Google Play review sign-in bypass.
 *
 * Play reviewers cannot open the reviewer's email inbox, so a magic link sent
 * to them can never be clicked. For exactly one sacrificial demo address, the
 * app signs in with a password instead of sending a magic link.
 *
 * Configuration (both required, otherwise the bypass stays off):
 *
 *   EXPO_PUBLIC_REVIEWER_EMAIL=play-review@example.com
 *   EXPO_PUBLIC_REVIEWER_PASSWORD=a-throwaway-password
 *
 * Security notes — read before enabling:
 * - `EXPO_PUBLIC_*` values ship inside the app binary and are extractable by
 *   anyone. The reviewer account MUST be a throwaway demo account holding no
 *   real user data.
 * - The bypass is scoped to that single account: matching the email only ever
 *   signs into the reviewer account itself. Row Level Security still applies,
 *   so it can never read another user's rows.
 * - Anyone who learns the reviewer email can sign into the demo account.
 *   That is inherent to any review backdoor (a server-minted session would
 *   have the same property) — keep the account data-free.
 *
 * Setup: create the user in Supabase Auth (dashboard or
 * `supabase auth admin create-user`), confirm its email, and set the same
 * password. Password auth needs no extra Supabase project setting.
 */

export const REVIEWER_EMAIL_ENV_KEY = "EXPO_PUBLIC_REVIEWER_EMAIL" as const;
export const REVIEWER_PASSWORD_ENV_KEY = "EXPO_PUBLIC_REVIEWER_PASSWORD" as const;

type EnvLike = Record<string, string | undefined>;

export type ReviewerCredentials = {
    email: string;
    password: string;
};

/** The configured reviewer email, normalized — null when not configured. */
export function getReviewerEmail(env: EnvLike = process.env as EnvLike): string | null {
    const raw = env[REVIEWER_EMAIL_ENV_KEY]?.trim().toLowerCase() ?? "";
    return raw ? raw : null;
}

/**
 * Whether this (already normalized) email is the reviewer address.
 * Takes the normalized email so callers normalize once via `normalizeEmail`.
 */
export function isReviewerEmail(
    normalizedEmail: string,
    env: EnvLike = process.env as EnvLike,
): boolean {
    const reviewerEmail = getReviewerEmail(env);
    return reviewerEmail !== null && normalizedEmail === reviewerEmail;
}

/**
 * Credentials for the password sign-in, or null when the bypass is not fully
 * configured. Missing/empty password fails closed — callers must NOT fall
 * back to a magic link silently; surfacing an honest error keeps a broken
 * review build diagnosable instead of hanging on an inbox nobody reads.
 */
export function getReviewerCredentials(
    normalizedEmail: string,
    env: EnvLike = process.env as EnvLike,
): ReviewerCredentials | null {
    if (!isReviewerEmail(normalizedEmail, env)) return null;
    const password = env[REVIEWER_PASSWORD_ENV_KEY] ?? "";
    if (!password) return null;
    return { email: normalizedEmail, password };
}
