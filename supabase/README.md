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

Connected OAuth sources are server-side only — no `EXPO_PUBLIC_*` variable is ever needed. Set one id + secret pair per source you enable, plus the signing secret:

```sh
supabase secrets set SOURCE_OAUTH_STATE_SECRET=your-random-string
supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
supabase secrets set TODOIST_CLIENT_ID=... TODOIST_CLIENT_SECRET=...
supabase secrets set GITHUB_CLIENT_ID=... GITHUB_CLIENT_SECRET=...
supabase secrets set SLACK_CLIENT_ID=... SLACK_CLIENT_SECRET=...
supabase secrets set NOTION_CLIENT_ID=... NOTION_CLIENT_SECRET=...
```

Scheduled jobs (pg_cron) call edge functions through Vault-held secrets, never request headers. Create them once per project:

```sh
supabase db execute --project-ref <ref> --sql "select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'edge_function_base_url');"
supabase db execute --project-ref <ref> --sql "select vault.create_secret('<service-role-key>', 'edge_function_service_key');"
```

Mirror uses a server-side provider adapter selected by env. Configure provider secrets only in Supabase, never as `EXPO_PUBLIC_*` variables:

```sh
supabase secrets set AI_LLM_PROVIDER=openai-compatible AI_LLM_MODEL=model-name AI_BASE_URL=https://provider.example/v1 AI_API_KEY=...
```

Unknown `AI_LLM_PROVIDER` names fail closed with the same honest "not configured" state as missing credentials.

Changing these settings or adding an adapter under `functions/_shared/ai/providers/` does not require changes to MirrorCore, the mobile UI, or the database schema.

Memory evaluation uses the same provider secrets and abstraction. It runs best-effort after signal persistence; an evaluation failure never removes the source message or its signals.

Voice reflections transcribe uploads through the same provider (`AI_STT_MODEL` on `AI_BASE_URL`). When server STT is not configured, the app falls back to on-device transcription (OS speech recognizer, no API keys) and submits the text through the same function, persisted with `source: on_device_transcription` — same idempotency, persistence, and processing as audio uploads.

Realtime voice conversations use a separate session-mint flow. Provider
selection happens server-side with one top-level selector (never exposed to
the React Native client, and raw API keys never leave the server — session
specs carry only short-lived session tokens):

```sh
supabase secrets set AI_VOICE_PROVIDER=openai AI_REALTIME_MODEL=gpt-4o-mini-realtime-preview OPENAI_API_KEY=...
supabase functions deploy realtime-session
```

`AI_VOICE_PROVIDER` is the single voice selector; unknown names fail closed
with `REALTIME_NOT_CONFIGURED`, and the server never falls back to another
provider or reads another provider's credentials.

## Voice provider configuration matrix

| Provider | Required API key | Required model/config | NOT required | Voice architecture used |
|---|---|---|---|---|
| `openai` | `OPENAI_API_KEY` | `AI_REALTIME_MODEL` | `SARVAM_API_KEY`, `GEMINI_API_KEY`, separate STT/TTS config for the realtime session | Realtime bidirectional audio; the provider handles realtime transcription + audio response (existing OpenAI realtime session/protocol, reused as-is) |
| `gemini` | `GEMINI_API_KEY` | `AI_GEMINI_LIVE_MODEL` | `SARVAM_API_KEY`, `OPENAI_API_KEY`, separate STT/TTS config (Gemini Live owns them) | Realtime bidirectional audio/live session; auth/protocol/model details stay inside the Gemini adapter |
| `sarvam` | `SARVAM_API_KEY` | `AI_STT_MODEL`, `AI_TTS_MODEL`, `AI_LLM_PROVIDER`, `AI_LLM_MODEL` | `OPENAI_API_KEY`, `GEMINI_API_KEY`, `AI_REALTIME_MODEL` | Realtime Sarvam STT → final transcript → existing Aks LLM pipeline → streamed Sarvam TTS; user interruption stops TTS immediately; no separate LLM, no separate realtime model |

Examples:

```sh
# Gemini Live
supabase secrets set AI_VOICE_PROVIDER=gemini GEMINI_API_KEY=... AI_GEMINI_LIVE_MODEL=models/gemini-3.8-live
# Sarvam pipeline (LLM values are the existing Aks LLM pipeline)
supabase secrets set AI_VOICE_PROVIDER=sarvam SARVAM_API_KEY=... AI_STT_MODEL=saarika:v2.5 AI_TTS_MODEL=bulbul:v2 AI_LLM_PROVIDER=openai-compatible AI_LLM_MODEL=model-name
```

All 3 providers expose the same normalized voice events to the app
(`connecting`, `connected`, `listening`, `userSpeaking`,
`userTranscriptPartial`, `userTranscriptFinal`, `thinking`,
`assistantTextDelta`, `assistantAudio`, `assistantSpeaking`, `interrupted`,
`reconnecting`, `error`, `ended`) through the shared `RealtimeEvent`
contract — provider-specific code stays isolated in its own server adapter
(`functions/_shared/ai/realtime/voice.*.adapter.ts`) and client protocol
mapper (`src/services/realtime/protocols/*.protocol.ts`).

Voice and transcription models are selected the same way (`AI_TTS_MODEL` for the session voice, default `alloy`; `AI_STT_MODEL` for input transcription, default `whisper-1`). The chosen values travel in the session spec, so clients render them without naming vendors.

`realtime-session` verifies the user, checks conversation ownership when one is supplied, embeds the mirror context in the session instructions, and returns a short-lived ephemeral token spec. `AI_VOICE_PROVIDER` defaults to `openai`; without an API key/model the function returns `REALTIME_NOT_CONFIGURED` and the app reports the honest "not configured" state.

The app streams live PCM audio, so the mobile client must run in a native development build (Expo Go cannot stream live audio).
