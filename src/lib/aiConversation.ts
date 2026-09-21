/**
 * AiConversationScreen feature flag.
 *
 * The full-screen AI conversation experience is only available when
 * explicitly enabled via:
 *
 *   EXPO_PUBLIC_ENABLE_AI_CONVERSATION=true
 *
 * Missing/undefined/"false"/any other value means the screen stays
 * disabled: the route is not registered and its entry points stay on the
 * current screen. Follows the existing `EXPO_PUBLIC_* === "true"`
 * convention (see mirrorVoice recording flag).
 */

export const AI_CONVERSATION_ENV_KEY =
    "EXPO_PUBLIC_ENABLE_AI_CONVERSATION" as const;

type EnvLike = Record<string, string | undefined>;

/** Explicit boolean parser — never rely on JS truthiness. */
export function isAiConversationEnabled(
    env: EnvLike = process.env as EnvLike,
): boolean {
    return env[AI_CONVERSATION_ENV_KEY] === "true";
}

export const AI_CONVERSATION_ENABLED = isAiConversationEnabled();
