# Supabase auth setup

Apply `migrations/20260917000000_auth_profile_foundation.sql`, then deploy the account deletion function:

```sh
supabase db push
supabase functions deploy delete-account
supabase functions deploy mirror
supabase functions deploy mirror-observe
supabase functions deploy experiment
supabase functions deploy realtime-session
```

The next migration, `20260917010000_data_foundation.sql`, creates conversations, messages, reflections, check-ins, and traceable signals. It also installs ownership triggers, indexes, RLS policies, and the transactional `create_conversation_with_message` RPC.

`20260917020000_memory_engine.sql` adds evidence-backed memories, memory evidence links, user-scoped archive/delete RPCs, and the `memory_evaluation` AI task. Apply migrations before deploying `mirror`; the function expects these tables and RPCs to exist.

`20260917030000_pattern_engine.sql` adds evidence-backed patterns, pattern evidence links, lifecycle controls, and the `pattern_analysis` AI task. Pattern analysis is batched and runs best-effort after signal and memory processing.

`20260917040000_experiment_engine.sql` adds user-controlled experiments, explicit observations, lifecycle RPCs, and experiment-scoped AI analysis. Deploy the separate function with `supabase functions deploy experiment`.

`20260917050000_learning_engine.sql` adds experiment-backed learnings, evidence links, lifecycle controls, and the `learning_synthesis` task. Learning synthesis runs after durable experiment completion and can be retried through the experiment function.

With a local Supabase stack running, execute the database ownership tests with:

```sh
supabase test db
```

Deploy the callback function after linking the project:

```sh
supabase functions deploy auth-callback --no-verify-jwt
```

The callback site URL is:

```text
https://<project-ref>.supabase.co/functions/v1/auth-callback
```

Add both callback URLs to Supabase Auth redirect URLs:

```text
aks://auth/callback
https://<project-ref>.supabase.co/functions/v1/auth-callback
```

Development builds should be used for OAuth and magic-link testing because Expo Go callback URLs are not stable. Enable Google and GitHub in Supabase Auth. Enable Facebook only when its provider is configured and set `EXPO_PUBLIC_AUTH_FACEBOOK_ENABLED=true` in the app environment.

The `avatars` bucket is public so `user_metadata.avatar_url` remains a stable display URL. Write, overwrite, and delete operations remain restricted to the authenticated user's `{user_id}/avatar` path.

When legal documents change, update both the versions in `src/services/legal.service.ts` and the server-controlled values in a new migration for `accept_current_legal()`.

Mirror uses one server-side OpenAI-compatible provider adapter. Configure provider secrets only in Supabase, never as `EXPO_PUBLIC_*` variables:

```sh
supabase secrets set AI_BASE_URL=https://provider.example/v1 AI_API_KEY=... AI_MODEL=model-name
```

Changing these settings or replacing `functions/_shared/ai/providers/openai-compatible.ts` does not require changes to MirrorCore, the mobile UI, or the database schema.

Memory evaluation uses the same provider secrets and abstraction. It runs best-effort after signal persistence; an evaluation failure never removes the source message or its signals.

Realtime voice conversations use a separate session-mint flow. Configure provider secrets only in Supabase:

```sh
supabase secrets set AI_REALTIME_PROVIDER=openai AI_REALTIME_MODEL=gpt-4o-mini-realtime-preview OPENAI_API_KEY=...
supabase functions deploy realtime-session
```

`realtime-session` verifies the user, checks conversation ownership when one is supplied, embeds the mirror context in the session instructions, and returns a short-lived ephemeral token spec. When `AI_REALTIME_PROVIDER` is unset the function returns `REALTIME_NOT_CONFIGURED` and the app reports the honest "not configured" state.

The app streams live PCM audio, so the mobile client must run in a native development build (Expo Go cannot stream live audio).
