# Aks.ai — Understand yourself, differently.

> A living personal mirror that turns everyday reflections into evidence-based
> behavioral understanding. Not a journal. Not a dashboard. Not therapy.
> A calm, conversational mirror for noticing what repeats, testing what changes it,
> and learning what actually works for you.

[![Expo SDK](https://img.shields.io/badge/Expo_SDK-57-000020?logo=expo&logoColor=white)](https://docs.expo.dev/versions/v57.0.0/)
[![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres_RLS_Edge_Functions-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![EAS Build](https://img.shields.io/badge/EAS_Build-remote_versioning-000020?logo=expo&logoColor=white)](https://docs.expo.dev/build/introduction/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-451_passing-vitestsuccess)](./src)

---

## Table of contents

- [What it is](#what-it-is)
- [Demo](#demo-screenshots--video)
- [How it works](#how-it-works)
- [Key features](#key-features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment](#environment)
- [Scripts](#scripts)
- [Builds & releases](#builds--releases)
- [Backend](#backend-supabase)
- [Principles](#principles-golden-rules)
- [Localization](#localization)
- [Roadmap](#roadmap)
- [License](#license)

---

## What it is

Aks collects what you *choose* to share — check-ins, reflections, conversations —
structures it into signals, connects repeated evidence into patterns, helps you
test hypotheses through small experiments, and returns understanding at moments
when it is likely to matter.

Three things are always kept separate:

1. **Your words** — raw source, never overwritten.
2. **Source observations** — normalized facts from connected sources (no raw GPS, no message bodies).
3. **Aks's inferences** — always linked back to the evidence that produced them.

Numbers come from real data or not at all. Correlation is never reported as causation.
Aks stays fully useful with **zero** sources connected.

---

## Demo — screenshots & video

> Screenshots and a product video will live here.

| Mirror | Timeline | You |
| --- | --- | --- |
| ![Mirror — coming soon](docs/screenshots/mirror.png) | ![Timeline — coming soon](docs/screenshots/timeline.png) | ![You — coming soon](docs/screenshots/you.png) |

Additional captures can go in `docs/screenshots/`:

```text
docs/
  screenshots/
    mirror.png
    timeline.png
    you.png
    check-in.png
    experiment.png
    onboarding.png
  video/
    demo.mp4        # or link below
```

Demo video (placeholder — replace with your link):

```text
https://your-hosting-url/aks-demo.mp4
```

---

## How it works

```text
You act  →  Signals  →  Memories  →  Patterns  →  Insights
               │            │            │             │
               ▼            ▼            ▼             ▼
           Check-ins   Durable       3+ repeated   Strong-evidence
           Reflections context      evidence only  summaries with
           Turns       (revisable)   (association,  "why?" sources
                                     never cause)
```

**Experiments close the loop:**

```text
Pattern → Experiment (draft → active → complete)
            → Observations (idempotent, request-id safe)
              → Deterministic metrics from real data
                → Learning (revisable, archivable)
```

See [`features.md`](./features.md) for the full "you do this → the app does that" map.

---

## Key features

### Mirror (conversation-first home)

- Time-aware greeting — morning / afternoon / evening / night (`src/lib/dayPart.ts`), localized across all 9 languages.
- Topic chips (Focus, Energy, Sleep, Emotions, Routines, Relationships, Productivity) and quick check-ins (Good / Okay / Chaos).
- Messages save **before** AI runs (`create_conversation_with_message` RPC + request id); retries replay instead of duplicating.
- Live on-device dictation into the composer; legacy audio-record fallback is env-gated and off by default.
- Crisis-safety phrases bypass AI with a fixed supportive response.
- Streaming replies, optimistic send, arrival-only motion, offline outbox.

### Intelligence loop

- **Signals** — small factual observations from check-ins, reflections, turns.
- **Memories** — durable context, created/updated/rejected by the memory engine, never one-memory-per-message.
- **Patterns** — proposed only after 3+ occurrences; association, never causation.
- **Insights** — generated on strong evidence, each traceable to sources ("how do you know?" has a real answer).

### Experiments & learnings

- Hypothesis + date-bounded drafts, explicit observations, honest completion summaries computed from real observations — never invented numbers.
- Learnings synthesize from outcomes and revise/archive when evidence contradicts them.

### Timeline

- A **projection** of meaningful events (check-ins, reflections, patterns, experiments, learnings, insights) — not one row per message — so busy days never flood the list.

### Connected sources (all optional, one-by-one)

- Device: location (coarse windows, never raw coordinates), calendar, reminders/tasks, screen time, photos, voice.
- OAuth: Google Calendar/Tasks, Todoist, Notion, GitHub, Slack, Email.
- Restricted sources (calls, SMS bodies, notification history) are honestly marked unavailable and never requested.
- Bounded sync windows, stable-id dedup, per-source disconnect and per-source "delete imported data" that never touches conversations or memories.

### Notifications (delivery only)

- Preferences + quiet hours (timezone-aware, midnight-crossing safe) in `user_preferences` as source of truth.
- Policy pipeline: preference → quiet hours → freshness → dedup → OneSignal.
- Self-cancelling reminders (already checked in → no evening nag), bounded retries, sent/failed/opened tracking.

### Subscriptions

- RevenueCat entitlement is the source of truth, server-verified; the client never trusts a local boolean.
- Single kill-switch (`EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED=false`) for running without limits in development.

### Data controls & privacy

- RLS everywhere — every row stamped with your user id; user A can never read user B's data.
- Export data / delete account from settings; deletion cascades domain rows and detaches push identity.
- Unsent drafts live on-device only, never uploaded.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| App | Expo SDK 57, React Native 0.86, React 19.2, TypeScript (strict) |
| Navigation | React Navigation (bottom tabs + native stack), 3-page pager: Timeline · Mirror · You |
| UI / motion | Tailwind (`uniwind` + `tailwind-merge` + `clsx`), Reanimated, HugeIcons, Lottie |
| Fonts | Satoshi (light → black) via `expo-font` |
| State / data | Supabase Postgres + RLS + RPCs, repositories per domain, offline outbox |
| AI | Provider-neutral service → Supabase Edge Functions (`mirror`, `mirror-observe`, `experiment`, `realtime-session`) with OpenAI-compatible / Gemini / Sarvam adapters |
| Voice | On-device live dictation (`expo-speech-recognition`); server STT only on the gated fallback |
| Push | OneSignal (dev vs production mode follows the EAS build profile) |
| Billing | RevenueCat (`react-native-purchases`) + webhook-synced Supabase mirror |
| i18n | 9 languages — en, hi, fr, es, zh, ja, ko, ar (RTL), ur (RTL) — via centralized `copy` + `Translation` parity tests |
| Builds | EAS Build (`eas.json`: `base` + `development` / `preview` / `production`, remote versioning, Node 22) |
| Tests | Vitest (unit + contract), `tsc --noEmit` |

---

## Project structure

```text
aks/
  App.tsx                  # providers + root navigator
  index.ts                 # expo-router entry
  app.config.js            # dynamic config (bundle id com.miyal.aks, plugins, OneSignal mode)
  eas.json                 # base + extends build profiles, remote app versions
  assets/                  # icon, splash, adaptive icon, Satoshi fonts
  src/
    screens/               # auth · mirror · timeline · you · legal
    components/            # mirror composer, ui kit (Text, IconButton, BottomSheet…)
    navigation/            # AppNavigator, MainNavigator (pager), YouNavigator, routes
    providers/             # Language, Preferences, Auth, Theme…
    hooks/                 # useAuth, useMirror, …
    services/              # mirror, voice, notifications, subscription, drafts…
    repositories/          # Supabase access per domain (RLS-safe)
    lib/                   # dayPart, date, motion, cn, aiConversation…
    constants/copy.ts      # English source of truth — no hardcoded UI strings elsewhere
    localization/          # hi fr es zh ja ko ar ur + languages.ts registry
    theme/                 # colors, spacing
    types/                 # data, mirror…
    idea/                  # product specs & explorations (not shipped)
  supabase/
    migrations/            # auth → data → memory → pattern → experiment → learning
    functions/             # mirror, mirror-stream, mirror-observe, experiment,
                           # voice-reflection, provider-sync, notifications-*,
                           # revenuecat-webhook, delete-account, export-data…
    README.md              # backend setup guide
  docs/                    # screenshots/ + video/ (add yours — see Demo)
  features.md              # behavioral map of the app
  scripts/                 # maintenance / tooling
```

---

## Getting started

**Prerequisites:** Node 22.13+, npm, Expo CLI (via `npx`), Supabase CLI, EAS CLI 24.7+, Xcode / Android Studio for native builds.

```sh
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# fill EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
# EXPO_PUBLIC_ONESIGNAL_APP_ID, RevenueCat keys…

# 3. Run
npm start            # Expo dev server
npm run android      # dev build on Android
npm run ios          # dev build on iOS (Simulator needs a development build)
npm run web          # web (dev)

# 4. Verify
npm test             # vitest
npm run typecheck    # tsc --noEmit
```

> Live voice and OAuth callbacks need a **development build** (`npx expo run:android/ios`
> or EAS `development` profile). Expo Go URLs are not stable enough for callbacks.

---

## Environment

Client (`EXPO_PUBLIC_*`, inlined at bundle time — rebuild after changing):

```sh
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
EXPO_PUBLIC_ONESIGNAL_APP_ID=your-onesignal-app-id
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=your-ios-api-key
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=your-android-api-key
EXPO_PUBLIC_REVENUECAT_WEB_API_KEY=your-web-api-key
EXPO_PUBLIC_AUTH_FACEBOOK_ENABLED=false
EXPO_PUBLIC_ENABLE_MIRROR_VOICE_RECORDING=false   # keep off unless you need the legacy fallback
# EXPO_PUBLIC_ENABLE_AI_CONVERSATION=true          # opt-in full-screen AI route
# EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED=false          # dev bypass (client side)
```

Server (Supabase secrets — never `EXPO_PUBLIC_*`):

```sh
supabase secrets set AI_LLM_PROVIDER=openai-compatible AI_BASE_URL=… AI_API_KEY=… AI_LLM_MODEL=…
supabase secrets set ONESIGNAL_REST_API_KEY=…
supabase secrets set SOURCE_OAUTH_STATE_SECRET=… GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… # per source
supabase secrets set REVENUECAT_WEBHOOK_SECRET=…
```

Full variable reference lives in [`.env.example`](./.env.example).

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run android` / `npm run ios` | Run on device/emulator via dev build |
| `npm run web` | Web dev (`--localhost`) |
| `npm test` | Vitest suite (52 files / 451 tests) |
| `npm run typecheck` | Strict TypeScript check |

---

## Builds & releases

`eas.json` uses a shared `base` profile (Node `22.23.1`, shared `EXPO_PUBLIC_*` env) with
`development` (dev client, internal), `preview` (internal, Android APK, iOS Simulator),
and `production` (`autoIncrement: true`, remote `appVersionSource`).

```sh
eas build --profile development   # dev client for testing voice/OAuth
eas build --profile preview       # internal APK / simulator build
eas build --profile production    # store build (versions auto-increment remotely)
eas submit --profile production   # store submission
```

Validate resolved config per profile any time with:

```sh
npx eas config --platform android --profile production --non-interactive
```

---

## Backend (Supabase)

Migrations apply in engine order — auth → data foundation → memory → pattern →
experiment → learning — then Edge Functions deploy (`mirror`, `mirror-observe`,
`experiment`, `realtime-session`, `voice-reflection`, `provider-sync`,
`notification-dispatch`, `notifications-schedule`, `revenuecat-webhook`,
`delete-account`, `export-data`, `auth-callback`…).

Auth callbacks to allow:

```text
aks://auth/callback
https://<project-ref>.supabase.co/functions/v1/auth-callback
```

Step-by-step: [`supabase/README.md`](./supabase/README.md).

---

## Principles (golden rules)

- Raw words, source observations, and inferences stay separate — always.
- Evidence-backed or it didn't happen: memories link evidence, patterns need 3+ occurrences, metrics derive from real observations.
- Association, never causation.
- Honest states over silent failure: "not configured / couldn't hear / try again" instead of invented content.
- No scattered UI strings: everything user-visible lives in `src/constants/copy.ts`; every translation satisfies the `Translation` type and parity tests.
- Offline-first where it matters: drafts and outbox survive the app; sends are idempotent.

---

## Localization

9 languages with runtime switching (`LanguageProvider` + `applyLanguage`), RTL-aware layouts,
and compile-time + runtime parity checks (`copy.test.ts`, `languages.test.ts`):

`en` · `hi` · `fr` · `es` · `zh` · `ja` · `ko` · `ar` · `ur`

Adding one: add the table under `src/localization/<code>.ts`, register it in
`src/localization/languages.ts` — the `Record<Language, …>` type and the parity
tests fail until the table is complete.

---

## Roadmap

- [ ] Screenshots + demo video (see [Demo](#demo-screenshots--video))
- [ ] Store listings (App Store / Play) copy + review prep
- [ ] EAS Update channels for OTA fixes
- [ ] Deeper experiment analytics from real observations
- [ ] More connected sources (behind the same one-by-one consent model)

---

## License

MIT — see [LICENSE](./LICENSE).

*Built with Expo SDK 57 · React Native 0.86 · Supabase.*
