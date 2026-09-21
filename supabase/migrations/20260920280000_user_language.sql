-- ---------------------------------------------------------------------------
-- Store the user's display language on the account (spec: preferences)
-- ---------------------------------------------------------------------------
-- The language choice stays device-local for instant access and is mirrored
-- here so it follows the account across devices. NULL means "no explicit
-- server-side choice yet": clients keep their device choice and push it up,
-- so no existing user's UI language changes out from under them.

alter table public.user_preferences
    add column if not exists language text;

-- Only offered language codes may be stored. Extending this list is part of
-- adding a language, so the server can never hold an unsupported value.
alter table public.user_preferences
    add constraint user_preferences_language_check
    check (language in ('en', 'hi', 'fr', 'es', 'zh', 'ja', 'ko', 'ar', 'ur'));
