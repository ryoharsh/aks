---
title: "AKS — Mirror Application Complete Product, SRS, Architecture, UI & Shipaton Report"
version: "1.0 - Master consolidation"
date: "18 September 2026"
product: "Aks.ai"
core_interface: "Mirror"
---

AKS

Mirror Application - Complete Product, SRS, Architecture, UI & Shipaton Report

Understand yourself, differently.

A consolidated master document capturing the product idea, product philosophy, feature roadmap, UX direction, technical architecture, backend/data model, AI architecture, implementation phases, screen requirements, UI prompt pack, non-functional requirements, current project state, risk/gap audit, and Shipaton 2026 positioning.

| Document | Value |
| --- | --- |
| Version | 1.0 - Master consolidation |
| Date | 18 September 2026 |
| Primary product | Aks.ai |
| Core interface | Mirror |
| Frontend | React Native + Expo |
| Backend/data | Supabase |
| AI architecture | Provider-agnostic AI Service + Provider Adapter |
| Monetization | RevenueCat |
| Status | Architecture and implementation plan consolidated; explicit completion status is called out where known |

| Important status note <br> This document consolidates the decisions, requirements, prompts, architecture, and implementation notes established in the conversation. Where the conversation explicitly confirmed implementation, that is marked as confirmed. Where we only created a prompt or design, this report marks it as specified/planned and recommends repository verification before calling it shipped. |
| --- |

# Table of Contents

1. Executive Summary

2. Product Origin and Idea

3. Product Thesis and Philosophy

4. What Aks Is Not

5. Core User Problem and Product Promise

6. Core Product Loop

7. Product Architecture

8. Application Navigation and Screen Map

9. Screen-by-Screen Product and UI Specification

10. Mirror: Primary Intelligence Interface

11. MirrorCore and Behavioral Intelligence Pipeline

12. Memory Engine

13. Pattern Engine

14. Experiment Engine

15. Learning Engine

16. Insight Engine

17. Timeline

18. Notifications

19. Privacy and Data Control

20. Subscription and RevenueCat

21. Profile, Settings and Account

22. Backend and Supabase Data Foundation

23. Database Schema and Relationships

24. AI/LLM Architecture and Safety Rules

25. Security, RLS and Data Ownership

26. SRS - Functional Requirements

27. SRS - Non-Functional Requirements

28. Implementation Phases and What We Did

29. Current State and Regression / Missing-Feature Audit

30. Protected Decisions - Things That Must Not Quietly Return or Disappear

31. UI Prompt Pack

32. Shipaton 2026 Opportunity Map

33. Shipaton Submission Strategy and Demo Story

34. Production Readiness Checklist

35. Final Product Definition

Appendix A - Canonical Copy and Phrases

Appendix B - Technical Quick Reference

Appendix C - Sources

# 1. Executive Summary

Aks is a personal behavioral understanding system whose central promise is not to tell a person who they are, but to help them observe themselves more clearly. The name Aks comes from the idea of a reflection: the app is intended to act like a living personal mirror that collects what the user chooses to share, structures observations, detects possible relationships, helps the user test hypotheses, and gradually turns experience into better self-understanding. The product is explicitly different from a generic journal, a productivity dashboard, a therapy product, or a generic chatbot.

The primary interface is Mirror. Mirror is the conversational front door into Aks, but the conversation itself is only the beginning of the system. What the user says can become structured signals; repeated signals may become candidate memories or patterns; patterns can lead to experiments; experiments generate observations; observations support learnings; and meaningful learnings can produce insights. The system then returns those useful observations back to the user through Mirror, Timeline, and carefully controlled notifications. This creates a closed behavioral learning loop rather than a one-shot chat experience.

The product is designed around evidence-first reasoning. Aks must not turn uncertain inference into fact. The system should prefer language such as “appears associated,” “may,” “might,” “possible pattern,” “worth exploring,” and “evidence suggests” where uncertainty remains. Derived information must remain traceable back toward source evidence. AI can propose structured observations and interpretations, but the application domain and database remain authoritative for persistence, state, permissions, and deterministic counts.

Technically, the app separates presentation, product/domain orchestration, persistence, and AI provider infrastructure. React Native handles UI and local interaction. MirrorCore is the central intelligence/orchestration layer. Data repositories handle Supabase. AI Service exposes a provider-neutral interface. Provider-specific code lives in an AI Provider Adapter so the product can move between Microsoft Foundry, OpenAI, Anthropic, Gemini, local models, or another provider without rewriting the product domain. RevenueCat is the source of truth for purchases and entitlements, with Supabase acting only as a controlled mirror where needed.

The product roadmap built through the conversation is: Auth + Profile, Data Foundation, Mirror, Signals, Memory, Patterns, Experiments, Learnings, Insights, Timeline, Notifications, Privacy/Data Control, Subscription, and finally the separate mascot presentation layer. The mascot is deliberately deferred; it should be a future presentation layer that consumes a semantic state from the intelligence system rather than becoming another source of product logic.

# 2. Product Origin and Idea

The original product direction was not “build another AI chat app.” The underlying idea was to create something closer to a personal mirror: a system that helps a user notice what is happening inside their own behavior over time. Traditional journaling is often a storage mechanism, while generic AI chat is optimized around individual conversations. Aks was shaped to sit between those ideas and turn repeated experiences into structured understanding.

The phrase “Understand yourself, differently.” became the product identity because the goal is not simply to record thoughts. The goal is to create a new way of looking at the same life data: what changes, what repeats, what seems related, what is still ambiguous, and what is worth testing. Aks therefore treats the user’s life as an ongoing observation process rather than a collection of diary entries.

A major product decision was to avoid gamification as the foundation of retention. No streaks, badges, XP, rankings, forced check-ins, or guilt-based reminders should be needed to keep the user returning. The intended retention loop is epistemic and personal: “Aks noticed something interesting.” The user returns because the system has helped them learn something useful about themselves, not because the product punishes them for inactivity.

The idea also evolved toward a personal behavioral laboratory. In that framing, the user is both observer and participant. Aks helps gather evidence, organize it, detect possible relationships, test a hypothesis with an experiment, observe the result, and extract a learning. That makes the product closer to a continuous behavioral learning system than a diary.

# 3. Product Thesis and Philosophy

## Reflection over performance

The product measures understanding, not productivity. The experience should never imply that a user is failing because they did not check in, write enough, or maintain a streak.

## Evidence over certainty

The system distinguishes raw observations from interpretations. Signals are candidate observations, memories are useful retained information, patterns are relationships supported by evidence, experiments are tests, learnings are conclusions drawn from evidence, and insights are meaningful summaries worth surfacing.

## Human agency over automation

Aks assists the user in noticing and testing. It does not make life decisions for the user. Suggestions are framed as things worth exploring, not instructions that define what the user must do.

## Useful memory, not total memory

Aks should not remember every sentence equally. Memory is selective. A memory survives because it is useful for future understanding and has an evidence trail.

## Selective attention

Notifications are reserved for moments that may genuinely matter. Timeline keeps history readable without becoming an exhaustive activity log.

## Provider independence

The product is built around a replaceable AI layer. The business domain must never depend on a single model vendor.

# 4. What Aks Is Not

Aks is intentionally not a generic journaling app. Journaling is one input mechanism, but the value is in the subsequent observation and learning pipeline.

Aks is not a generic chatbot. Mirror is conversational, but the conversation feeds a broader behavioral system and should eventually be reflected through memories, patterns, experiments, learnings, insights, and timeline events.

Aks is not a conventional productivity tracker. Focus, routines, energy, sleep, and productivity can be topics, but the product should not reduce them to dashboards and scores.

Aks is not a therapy or medical diagnosis product. Product copy must avoid presenting behavioral inference as diagnosis, certainty, or professional clinical judgment.

Aks is not a social network. There is no follower graph, leaderboard, public feed, or comparison layer in the core product.

Aks is not a mascot-first app. The future 3D character is a presentation layer that communicates semantic state; it is intentionally separate from the core intelligence system.

# 5. Core User Problem and Product Promise

People often experience repeated cycles without being able to see the structure of those cycles. They may feel that they “keep ending up here,” notice that certain situations affect them differently, or suspect that a behavior changes under certain conditions, but their evidence is fragmented across memory, conversations, notes, and everyday experience. The product problem is therefore not a lack of information; it is a lack of longitudinal structure.

Aks promises to turn fragmented personal observations into a calm, traceable mirror. The system collects voluntary inputs, normalizes them into signals, connects repeated evidence, tests hypotheses through experiments, and returns the resulting understanding to the user at moments when it is likely to matter.

| One-line product definition <br> Aks is a living personal mirror that turns everyday reflections and observations into evidence-based behavioral understanding. |
| --- |

# 6. Core Product Loop

```text
Observe → Structure → Detect Pattern → Validate → Experiment → Measure → Learn → Observe again
```

Observe means the system captures what the user actually says or records. Structure means turning free-form information into typed source records and candidate signals. Detect Pattern means looking for repeated relationships across signals rather than treating a single message as a fact. Validate means attaching evidence and checking whether a pattern remains plausible. Experiment means testing a hypothesis in a real context. Measure means collecting observations without pretending that every result is scientifically conclusive. Learn means summarizing what the evidence supports. Observe again means feeding the learning back into future conversations and analysis.

This loop is the product moat. Any individual screen can be copied; a coherent system that connects source data, evidence, memory, patterns, experiments, learnings, insights, and timeline over time is substantially harder to replicate as a coherent product experience.

# 7. Product Architecture

```text
React Native UI
  ↓
Feature Hook
  ↓
Core Service / MirrorCore
  ↓
Data Repository / AI Service
  ↓
Supabase / AI Provider Adapter
```

React Native owns presentation, navigation, local UI state, keyboard behavior, recording controls, and animation. It should not own product intelligence. Feature hooks expose state and actions to screens without making screens responsible for persistence or reasoning.

MirrorCore is the central application orchestration layer. It coordinates conversation processing and the transition from user input to structured domain events. It should not know which AI vendor is being used. AI Service is an interface that turns a product task into a provider-neutral request and receives structured output. Only the provider adapter knows the provider-specific SDK, endpoint, model identifier, request format, or authentication details.

Supabase handles authentication, database, row-level security, storage where appropriate, realtime capabilities where useful, and backend/Edge Function logic. Domain repositories should centralize database interaction rather than letting each screen call Supabase directly.

RevenueCat sits outside the intelligence system as the subscription/purchase authority. This is an important architectural separation: billing state should not be inferred by MirrorCore, Timeline, or AI.

# 8. Application Navigation and Screen Map

```text
Root
├── Splash
├── Onboarding
├── Auth
│   ├── Login
│   ├── Register
│   ├── Terms
│   └── PrivacyPolicy
├── LegalAcceptance
└── MainNavigator
    ├── Timeline
    ├── Mirror
    └── YouNavigator
        ├── YouHome
        ├── Patterns
        ├── Experiments
        ├── Learnings
        ├── YourData
        ├── Notifications
        ├── Appearance
        ├── Privacy
        ├── HelpFeedback
        └── Settings
```

The main navigation is a custom horizontal ScrollView pager rather than React Navigation’s createBottomTabNavigator. The pager indexes are: 0 Timeline, 1 Mirror, 2 You. Mirror is the centered/default page. The You area is a nested native stack because its content is a set of deeper account and understanding surfaces.

There is intentionally no MainStackParamList in the architecture. Navigation types should remain local to the navigator where they belong, keeping the root architecture easier to evolve.

# 9. Screen-by-Screen Product and UI Specification

| Screen | Required experience |
| --- | --- |
| Splash | Purpose: restore the minimum boot state without flashing the wrong route. The screen should be visually quiet and short-lived. It decides whether onboarding, authentication, legal acceptance, or the protected app should render after local and remote state restoration. |
| Onboarding | Purpose: establish the mental model of Aks, not explain every feature. The onboarding should communicate that Aks helps a user notice repeated patterns over time, not simply chat. Collect only meaningful preference/context needed by the product; avoid turning onboarding into a long form. |
| Login | Purpose: fast, trustworthy access. Support the already established auth methods, validation, loading states, accessibility, and user-friendly errors. Avoid decorative complexity. |
| Register | Purpose: create an account with the same auth infrastructure as login. Preserve magic-link and supported OAuth flows. Confirmation and resend flows must be truthful. |
| Terms / Privacy Policy | Use the shared legal flow. Legal content is separate from the product’s Privacy/Data Control center. |
| LegalAcceptance | Gate protected access when the legal acceptance version requires it. Persist immutable server-stamped acceptance rather than trusting a local checkbox as authority. |
| Timeline | A chronological personal story. Header: “Timeline”. Suggested supporting text: “A quiet record of things worth noticing.” Filters: All, Insights, Experiments, Check-ins, Decisions. Group by TODAY, YESTERDAY, THIS WEEK, OLDER. Only meaningful events appear. No scores, streaks, fake entries, or analytics-feed behavior. |
| Mirror | Primary intelligence interface. Calm conversation surface with text, voice, topic chips/controls, check-in entry, and composer actions. Mirror should feel like talking to the reflection engine, not using a generic chat bot. |
| YouHome | Personal control and understanding hub. Surface navigation to Patterns, Experiments, Learnings, Your Data, Notifications, Appearance, Privacy, Help & Feedback, and Settings. Do not turn it into a vanity analytics dashboard. |
| Patterns | Show possible relationships supported by evidence. A pattern has status, confidence language, evidence count, and links to evidence. Avoid declaring “this is true” from weak evidence. |
| Experiments | Show active/completed experiments and allow starting or updating a test. Explain hypothesis, observation, and outcome in simple language. Do not turn experiments into habit streaks. |
| Learnings | Show what the system has learned from evidence and experiments. Learnings can be revised when new evidence conflicts or adds nuance. |
| Insights | Surface meaningful, selective things worth noticing now. An insight references a pattern, experiment, or learning when possible. It must be explainable and non-duplicative. |
| Your Data | Transparency and control layer. It should connect to data usage/access/export/delete without becoming a developer database browser. |
| Notifications | “Only when it matters.” Preserve category toggles, global permission state, quiet hours, preview examples, and “A Note From Aks”. Notifications are delivery history, not intelligence. |
| Appearance | Persist the existing appearance preference and apply it to Uniwind theme behavior. Keep the surface simple; no duplicate theme system. |
| Privacy | Privacy/Data Control center with Data Usage, Data Access, Export Data, Delete Data, and Privacy Policy. |
| Help & Feedback | Nested navigator with HelpFeedbackHome, FAQ, ReportProblem, SendFeedback. Keep support separate from behavioral memory. |
| Settings | Only Profile, Subscription, About, Account. This is intentionally compact because Notifications, Appearance, Privacy, Your Data, and Help & Feedback are already exposed in You. |
| Profile | Show avatar, name, email, what the user is exploring, and what Aks should notice. Do not display behavioral stats, patterns, check-in counts, or derived profile scores. |
| Subscription | RevenueCat-backed plan and entitlement experience. Localized price comes from RevenueCat/store product metadata. RevenueCat remains source of truth. |
| About | Version/build, Terms, Privacy, and basic product/company information. Do not duplicate legal or privacy logic. |
| Account | Sign out and delete account. Make the distinction explicit: logout ends the session; deletion is destructive and permanent under the actual backend rules. |

# 10. Mirror: Primary Intelligence Interface

Mirror is the most important screen in Aks. It is the place where the user can think aloud, reflect, answer a structured check-in, or speak through voice input. But Mirror should not behave like a typical consumer chatbot where every interaction is a self-contained prompt/response pair. Its real job is to feed and read from the broader behavioral system.

The current Mirror code architecture already contained typed concepts for user/Aks messages, processing state, check-in values, submission kinds, and the voice recording flow. It also had a typed integration boundary called submitToAks that deliberately threw MIRROR_BACKEND_NOT_CONFIGURED rather than fabricating assistant responses. This is a good architectural boundary: the UI can exist before intelligence backend integration is ready without inventing fake AI output.

Topics previously defined for Mirror include Focus, Energy, Sleep, Emotions, Routines, Relationships, and Productivity. These topics should be contextual controls, not a rigid taxonomy that forces every conversation into one category.

The intended composer behavior is specific: the left side exposes the keyboard/input affordance, the center X closes the composer/clears draft without deleting the conversation, and the right menu exposes actions such as New conversation and Conversation history. When there is no text, the composer can expose the microphone action; when text exists, it exposes Send. Keyboard opening should focus the input; the X should close the composer state rather than erase conversation history.

The initial Aks message established the tone: “I’ll help you notice what repeats, what changes, and what might be worth testing.” This sentence captures the intended role of Mirror better than generic conversational copy.

# 11. MirrorCore and Behavioral Intelligence Pipeline

MirrorCore is the application-level orchestrator behind Mirror. It should take a user submission, persist the raw source, run the appropriate AI task through the provider-neutral AI Service, validate structured output, and then hand derived observations to the proper domain engines. The central idea is that a conversation is not itself a pattern, memory, or insight. Those are separate domain objects with different evidence standards.

```text
Conversation → Messages → Signals → Memories / Patterns → Experiments → Learnings → Insights
```

AI should return structured JSON wherever possible. The structure should be validated before persistence. Fact counts, evidence counts, dates, ownership, and relational consistency should be handled deterministically by application/database logic. AI should propose interpretations, not become the database authority.

The processing pipeline should be idempotent where possible so retries do not create duplicate signals, duplicate insights, or duplicate notifications. Every derived object should carry evidence references sufficient to explain where it came from.

# 12. Memory Engine

Memory is the selective layer of what Aks chooses to carry forward. Not every message becomes a memory. A memory should exist because it is useful in future interactions and supported by evidence.

The canonical memory model includes memory_type, content, status (candidate/active/rejected/archived), confidence, evidence_count, first_observed_at, last_observed_at, and metadata. Evidence lives in memory_evidence, which can point toward a signal and/or the original source record.

Memory must be revisable. New evidence can strengthen, weaken, update, archive, or reject a candidate memory. The goal is not to build an immutable psychological profile; it is to maintain useful context with traceability.

# 13. Pattern Engine

Patterns describe relationships across observations. A pattern is not a single event and not a personality label. It should be represented as a candidate relationship that can move through states such as candidate, possible, testing, supported, not_supported, or archived.

The pattern model includes title, description, status, confidence, evidence_count, first_detected_at, last_observed_at, and metadata. pattern_evidence links the pattern to signals and records the relationship. The wording should remain calibrated to evidence strength.

A useful pattern can become the basis for an experiment, but the pattern engine should not force every candidate into an experiment. Some patterns will remain useful observations without requiring intervention.

# 14. Experiment Engine

Experiments turn hypotheses into real-world tests. The model includes an optional pattern link, title, hypothesis, description, status (draft/active/completed/cancelled), start/end dates, result_summary, confidence, and metadata.

Experiment observations record structured values, notes, and timestamps. Experiments should measure what happened rather than reward whether the user “completed” a behavior. This keeps the feature aligned with evidence instead of habit gamification.

Results must stay honest. A completed experiment can produce a learning, but the system should not imply causal certainty from a small personal experiment unless the evidence actually supports that level of confidence.

# 15. Learning Engine

Learning is the durable conclusion drawn from evidence, especially experiments and repeated observations. A learning can be active, revised, or archived. It includes title, description, confidence, evidence_count, optional source_experiment_id, and metadata.

Learnings are stronger than isolated observations but still revisable. When new evidence changes the conclusion, the product should revise or archive the previous learning rather than silently rewriting history.

Learnings are also a key bridge between deep analysis and user-facing insight. An insight can reference a learning so the user can understand why something is being surfaced.

# 16. Insight Engine

An insight is a meaningful piece of understanding worth surfacing now. It is not the same thing as a pattern, learning, or notification. The insight exists because timing and relevance make a piece of understanding worth showing.

The model includes type, title, content, optional pattern_id/experiment_id/learning_id, confidence, status (new/seen/dismissed/archived), and timestamps. The engine should be selective, explainable, and non-duplicative.

The AI task is insight_generation through the provider-neutral AI Service. AI proposes the candidate; Insight Service validates it, ensures references are valid, checks duplication, and persists only when the evidence and user context make it worthwhile. Notifications are downstream from insights, not part of insight generation.

# 17. Timeline

Timeline is the chronological memory layer. It is not an analytics feed, activity log, or performance dashboard. It is intended to help the user look backward and understand what was happening at different moments.

Timeline consumes timeline_events as a projection and should not become a second intelligence engine. It supports All, Insights, Experiments, Check-ins, and Decisions filters; groups records into TODAY, YESTERDAY, THIS WEEK, and OLDER; and only surfaces meaningful user-facing events. Supported event types include reflection, check-in, insight, pattern, experiment, experiment outcome, learning, decision, and conversation when real data exists.

Event rows can contain an icon, title, supporting text, timestamp, contextual label, and a navigation affordance when a valid detail screen exists. The empty state “Your story starts here.” is the intended tone. There must be no fake entries, scores, streaks, or synthetic weekly narratives.

# 18. Notifications

Notifications are a delivery mechanism, not intelligence. The existing screen direction is intentionally “Only when it matters.” It includes global notification permission, category switches for insights, experiments, check-ins, and weekly reflection, quiet hours, and an “A Note From Aks” section.

The four product categories are: New insights, Experiment updates, Check-in reminders, and Weekly reflection. Check-in reminders are opt-in. Quiet hours must support overnight ranges such as 22:00 to 07:00. Deduplication should use stable event/reference identities so the same insight or experiment event does not repeatedly notify.

The notification engine should evaluate global preferences, category preference, OS permission, quiet hours, duplicate status, event freshness, and delivery state before creating or delivering a notification. Copy should be helpful and calm; there should be no guilt, streaks, countdowns, or “you are falling behind” language.

# 19. Privacy and Data Control

Privacy is a user-facing control center, not just a legal page. The established routes are PrivacyHome, DataUsage, DataAccess, ExportData, DeleteData, and PrivacyPolicy. DataUsage explains what categories of information are used and why. DataAccess explains what the system currently has access to, including real connected sources where applicable. ExportData provides a secure way to retrieve user-owned data. DeleteData provides a deliberate destructive account-deletion flow. PrivacyPolicy opens the shared legal web view at https://hirixa.vercel.app/privacy.

Account data should not be duplicated in a new profile table. Existing auth.users holds email and user_metadata fields for name/avatar, while user_preferences holds appearance, what_exploring, and what_to_notice. Language and timezone were deliberately not persisted initially; timezone can be added later only if server-side scheduling genuinely requires it.

Deletion is distinct from logout. The authenticated delete-account Edge Function should perform destructive cleanup under server-side authorization and the client should clear its local sensitive state only after confirmed success. Export should collect user-owned product data without exposing secrets, internal provider credentials, or unnecessary operational telemetry.

# 20. Subscription and RevenueCat

RevenueCat is the purchase and entitlement source of truth. The app should initialize RevenueCat after the authenticated user is known, associate the current Aks user correctly, and normalize CustomerInfo into a simple useSubscription/subscriptionService interface. The UI must never grant premium from a local boolean or a client-controlled Supabase row.

Products and localized prices come from RevenueCat/store metadata. Trials, discounts, and billing periods should not be hardcoded unless the actual configured product metadata supports them. Purchase, restore, expiration, cancellation-with-active-access, and platform permission states must be represented truthfully.

The existing subscriptions table is a backend/application mirror: user_id, revenuecat_customer_id, entitlement, product_id, status, expires_at, updated_at. Where server-side RevenueCat webhook synchronization is used, it must be idempotent and trusted. The client must not be able to write itself into premium status.

# 21. Profile, Settings and Account

Profile is intentionally narrow. It contains avatar, name, email, what the user is exploring, and what Aks should notice. Behavioral analytics do not belong here. This keeps Profile an identity/context surface rather than another dashboard.

Settings contains exactly four primary entries: Profile, Subscription, About, Account. Other controls were deliberately moved to direct areas under You: Notifications, Appearance, Privacy, Your Data, and Help & Feedback. This avoids a deep settings maze.

The Account screen provides sign out and account deletion. Sign out terminates authentication. Delete account is a separate destructive operation and should use the existing server-side delete-account flow.

# 22. Backend and Supabase Data Foundation

Supabase is the operational data layer for Aks. The database is relational because the product depends on evidence chains, ownership, references, timestamps, and lifecycle state. The key goal is to preserve the raw source while building derived projections over it.

```text
User
 ├── conversations → messages → signals
 ├── reflections → signals
 ├── check_ins → signals
 └── signals → memories → patterns → experiments → learnings → insights
```

The data foundation uses row-level security extensively. Parent-child access must validate that the referenced parent belongs to the authenticated user. The application should not trust arbitrary user_id fields from clients even when the client is already authenticated.

Supabase also supports the infrastructure around the core product: auth, storage for avatars and other permitted files, realtime where useful, Edge Functions for privileged server operations such as account deletion and export, and tables that represent notifications, data sources, subscriptions, feedback, support, and AI observability.

# 23. Database Schema and Relationships

| Table | Core fields | Purpose |
| --- | --- | --- |
| user_preferences | user_id, appearance, what_exploring, what_to_notice | User-scoped app/context preferences |
| conversations | id, user_id, title, created_at, updated_at, archived_at | Conversation containers |
| messages | id, conversation_id, user_id, role, content, metadata, created_at | User/assistant/system conversation content |
| reflections | id, user_id, content, metadata, created_at | Standalone reflection records |
| check_ins | id, user_id, mood, energy, focus, stress, notes, metadata, created_at | Structured check-ins |
| signals | id, user_id, source_type, source_id, signal_type, value, confidence, observed_at, created_at | Candidate structured observations |
| memories | id, user_id, memory_type, content, status, confidence, evidence_count, first/last_observed_at | Selective carried-forward context |
| memory_evidence | id, memory_id, signal_id/message_id/reflection_id/check_in_id, created_at | Memory evidence links |
| patterns | id, user_id, title, description, status, confidence, evidence_count, first/last_detected_at | Possible relationships across evidence |
| pattern_evidence | id, pattern_id, signal_id, relationship, created_at | Pattern evidence links |
| experiments | id, user_id, pattern_id, title, hypothesis, description, status, dates, result_summary | Behavioral tests |
| experiment_observations | id, experiment_id, user_id, value, notes, observed_at, created_at | Experimental observations |
| learnings | id, user_id, title, description, confidence, evidence_count, source_experiment_id, status | Durable evidence-based conclusions |
| insights | id, user_id, type, title, content, pattern_id, experiment_id, learning_id, confidence, status | Meaningful surfaced understanding |
| timeline_events | id, user_id, event_type, title, description, reference_id, metadata, created_at | Chronological presentation projection |
| notification_preferences | user_id, enabled, category flags, quiet hours | Notification controls |
| notifications | id, user_id, type, title, body, references, scheduled/sent/read timestamps | Delivery/history records |
| notification_devices | id, user_id, push_token, platform, app_version, enabled, last_seen_at | Registered notification devices |
| data_sources | id, user_id, source_type, name, enabled, metadata, connected/disconnected_at | Connected source permissions |
| subscriptions | user_id, RevenueCat identifiers, entitlement, product, status, expires_at | Server-side billing mirror |
| feedback | id, user_id, type/content/metadata | Product feedback |
| support_requests | id, user_id, category/content/status | Support issues |
| ai_runs | id, user_id/task/provider/model/status/timestamps/metadata | Operational AI observability; not normal user-facing data |

# 24. AI/LLM Architecture and Safety Rules

The AI layer must be treated as a replaceable reasoning component, not a database authority. The product can use Microsoft Foundry today and still remain architecturally ready for a future switch to OpenAI, Anthropic, Gemini, a local model, or a self-hosted provider. Provider-specific configuration belongs only inside the provider adapter.

Every AI task should be typed. Candidate task types include signal extraction, memory evaluation, pattern analysis, experiment support, learning synthesis, and insight generation. The AI Service should return structured JSON. MirrorCore or the relevant domain service validates schema, ownership, references, confidence ranges, and duplication before persistence.

The system must never fabricate user facts, history, evidence, patterns, experiment outcomes, memories, insights, or confidence. It must not pretend to remember information that is not persisted. When evidence is weak, the product should say that evidence is limited.

Aks should not expose model chain-of-thought, hidden prompts, provider secrets, raw internal telemetry, or sensitive backend metadata. User-facing explanations should describe the evidence chain at an appropriate product level rather than exposing internal reasoning traces.

# 25. Security, RLS and Data Ownership

Authentication, authorization, data ownership, and privacy are part of the product architecture rather than a final security pass. All user-scoped tables should use RLS. Parent-child relations must enforce parent ownership. Destructive operations must run through privileged server-side code that derives the user identity from the authenticated context.

The avatar system already uses user-scoped storage policies. The account deletion flow uses an authenticated Edge Function. Session persistence is chunked through SecureStore on native platforms and compatible storage on web. Session restoration and onboarding persistence are part of root flow gating.

The application must never ship Supabase service-role keys, RevenueCat secret API keys, webhook secrets, or provider API secrets in the mobile bundle. Public client keys may be configured appropriately, but authorization must still be enforced in backend policies/functions.

Derived data deletion should not be confused with source-data deletion. Aks can maintain a provenance chain so that a user-facing insight can be traced through a learning/pattern to evidence and then back to the original conversation, reflection, check-in, or experiment record. Data deletion policies should define what source data and derived data are removed together, and the UI must reflect actual backend behavior rather than generic promises.

# 26. SRS - Functional Requirements

| ID | Area | Requirement |
| --- | --- | --- |
| FR-001 | Authentication | System shall restore an authenticated session on app launch and route the user through Splash, Onboarding, Auth, LegalAcceptance, or Main based on actual state. |
| FR-002 | OAuth and magic link | System shall support the configured magic-link and OAuth providers using the shared auth flow, with deduplicated PKCE callback handling. |
| FR-003 | Profile | System shall display and update name, avatar, email, exploring context, and what Aks should notice using existing auth metadata and user_preferences without a duplicate profile table. |
| FR-004 | Mirror input | System shall support text, voice, and check-in submissions in Mirror, preserving the source interaction before derived processing. |
| FR-005 | Conversation persistence | System shall persist conversations and messages with user ownership and role information. |
| FR-006 | Signal extraction | System shall derive candidate signals from supported sources through provider-neutral AI tasks and validate them before persistence. |
| FR-007 | Memory | System shall maintain evidence-linked memories with lifecycle status. |
| FR-008 | Patterns | System shall maintain evidence-linked candidate/possible/testing/supported/not-supported/archived patterns. |
| FR-009 | Experiments | System shall create and manage behavioral experiments and timestamped observations. |
| FR-010 | Learnings | System shall produce, revise, or archive evidence-based learnings. |
| FR-011 | Insights | System shall create selective insights linked to underlying understanding where available. |
| FR-012 | Timeline | System shall present meaningful chronological events from timeline_events, with filters and pagination. |
| FR-013 | Notifications | System shall evaluate notification eligibility using preferences, quiet hours, OS permission, deduplication, and event state. |
| FR-014 | Privacy usage | System shall explain user-facing data categories and purposes. |
| FR-015 | Privacy access | System shall show current connected data sources based on actual state. |
| FR-016 | Export | System shall provide an authenticated export flow without exposing secrets or another user’s data. |
| FR-017 | Delete account | System shall provide an explicit authenticated destructive deletion flow using the existing delete-account backend. |
| FR-018 | RevenueCat | System shall use RevenueCat as the source of truth for entitlement and purchase state. |
| FR-019 | Restore purchases | System shall allow users to restore purchases and refresh verified entitlement state. |
| FR-020 | Settings | System shall expose Profile, Subscription, About, and Account under Settings. |
| FR-021 | Help and feedback | System shall provide FAQ, problem reporting, and feedback flows that remain separate from behavioral memory. |
| FR-022 | Legal | System shall use the shared legal flow and the configured Privacy Policy web view. |

# 27. SRS - Non-Functional Requirements

| ID | Area | Requirement |
| --- | --- | --- |
| NFR-001 | Security | All user-scoped data access shall be authenticated and protected by RLS and/or trusted server operations. |
| NFR-002 | Privacy | The UI shall not expose secrets, hidden prompts, chain-of-thought, provider credentials, or internal operational metadata. |
| NFR-003 | Reliability | Failed persistence must be visible to the user; the app must never claim success before a real backend confirmation. |
| NFR-004 | Consistency | Derived state must be validated before persistence and duplicate processing should be avoided through idempotency where practical. |
| NFR-005 | Provider independence | No screen or core domain service shall call a specific AI vendor SDK directly. |
| NFR-006 | Performance | Timeline and other growing lists shall use virtualization/pagination rather than unbounded ScrollViews. |
| NFR-007 | Accessibility | Interactive controls shall have usable labels and state descriptions; color alone shall not communicate critical status. |
| NFR-008 | Internationalization readiness | Human-readable date/time formatting should use device locale; language persistence is intentionally deferred until required. |
| NFR-009 | Visual consistency | The app shall reuse the existing Uniwind theme, AppText, Button, IconButton, Hugeicons, and spacing language. |
| NFR-010 | Maintainability | Feature code shall be organized around clear services/hooks/screens rather than giant components or generic utility dumping grounds. |
| NFR-011 | Testability | Core services should be testable without rendering the full UI or requiring live AI/network calls for every unit test. |
| NFR-012 | Truthfulness | The system shall not fabricate user facts, evidence, history, confidence, or outcomes and shall calibrate language to evidence. |
| NFR-013 | Observability | Operational failures should be diagnosable without storing unnecessary private content in logs. |
| NFR-014 | Monetization integrity | Premium access shall be determined from RevenueCat entitlement state, not client-controlled flags. |

# 28. Implementation Phases and What We Did

| Phase | Module | What happened / was defined |
| --- | --- | --- |
| Phase 0 | Product foundation | Established Aks identity, reflection concept, tagline, core behavioral-learning thesis, anti-gamification stance, and evidence-first language. |
| Phase 1 | Auth + Profile | Defined and, in the conversation, explicitly confirmed a substantial implementation: AuthProvider, session restoration, Supabase subscriptions, magic-link, OAuth/PKCE, normalized errors, profile metadata, avatar flow, logout, delete-account Edge Function, local persistence, appearance, typed Supabase definitions, RLS migration, and verification steps. |
| Phase 2 | Data Foundation | Defined the relational model, RLS approach, user_preferences, conversations/messages/reflections/check_ins/signals and the Your Data direction as the base for later intelligence. |
| Phase 3 | Mirror + MirrorCore | Defined the Mirror screen, input modalities, composer behavior, typed submission boundary, central orchestration, provider-neutral AI gateway, structured JSON, and no-fabrication rule. |
| Phase 4 | Memory Engine | Defined selective memory, lifecycle states, evidence links, and future-context behavior. |
| Phase 5 | Pattern Engine | Defined relationship modeling, evidence links, confidence/status states, and distinction between candidate patterns and facts. |
| Phase 6 | Experiment Engine | Defined hypotheses, experiments, observations, statuses, outcomes, and the rule that experiments test hypotheses rather than become habit streaks. |
| Phase 7 | Learning Engine | Defined learnings as evidence-based conclusions that can be revised or archived. |
| Phase 8 | Insight Engine | Defined selective meaningful insights with links to patterns/experiments/learnings, validation, deduplication, and provider-neutral AI generation. |
| Phase 9 | Timeline | Defined chronological story projection, filters, date grouping, navigation, empty/error/loading states, and no duplicate intelligence logic. |
| Phase 10 | Notifications | Defined “Only when it matters”, category preferences, quiet hours, device registration, deduplication, history, preview examples, and OS settings shortcut. |
| Phase 11 | Privacy & Data Control | Defined Data Usage, Data Access, export, destructive deletion, Privacy Policy web view, source transparency, and data-control architecture. |
| Phase 12 | Subscription | Defined RevenueCat source-of-truth architecture, offerings, entitlements, purchase/restore, localized pricing, subscription state, and Supabase mirror constraints. |
| Phase 13 | Mascot - deferred | Defined a future 3D blob/ghost character concept and semantic state model but deliberately deferred implementation until core product features are completed. |

| Implementation-status rule <br> The conversation explicitly confirmed Auth + Profile implementation. For the subsequent modules, the conversation shows that detailed implementation prompts and architecture were created sequentially. Before a release claim, verify the actual repository for each phase rather than assuming that issuing a prompt means the code is fully shipped. |
| --- |

# 29. Current State and Regression / Missing-Feature Audit

The current conversation state is a mature architectural specification with implementation prompts covering the complete product. The project should now be audited against this document because the user’s concern is that some earlier capabilities may have been removed while the app evolved. The most useful next step is not to rewrite features blindly; it is to compare the repository against the canonical inventory below.

## What is explicitly known from the conversation

- Auth + Profile work was explicitly reported as implemented and tested.

- The app uses a custom horizontal main pager: Timeline → Mirror → You, with Mirror centered/default.

- The app uses React Native + Expo, Uniwind 1.12.0, Reanimated, React Navigation native stacks, Hugeicons, and AppText.

- No colors.ts or duplicate TS theme file should exist; semantic colors live in Uniwind.

- Mirror contains text/voice/check-in concepts and a typed backend boundary that previously refused to fabricate responses.

- The Supabase authentication URL configuration screenshot shows Site URL http://localhost:3000 and redirect URL aks://auth/callback. The production web URL is not represented by that screenshot and should not be assumed configured.

- Privacy Policy is intended to open https://hirixa.vercel.app/privacy through the shared LegalWebView.

## Items that should be verified in the repository now

- Are all feature services actually implemented, or only the prompts/specifications exist?

- Does Mirror write real messages/conversations and receive real AI output through MirrorCore?

- Are signals being persisted from real source records?

- Do memories, patterns, experiments, learnings, and insights have real evidence relationships?

- Are timeline_events being emitted by domain services, rather than synthesized inside Timeline?

- Does NotificationEngine actually evaluate preferences and quiet hours?

- Is RevenueCat configured with real products/entitlements and production store settings?

- Does export work through a secure backend path, and does delete-account match the UI wording?

- Are RLS policies enforcing ownership on every relevant child table?

- Are the future mascot files absent from core product logic until the mascot phase is deliberately started?

# 30. Protected Decisions - Things That Must Not Quietly Return or Disappear

| Protected decision | Why it matters |
| --- | --- |
| No generic chat drift | Mirror must stay connected to the behavioral understanding pipeline. A generic “assistant replies to everything” screen loses the core product distinction. |
| No fake intelligence | Never fabricate memories, patterns, insights, evidence, outcomes, confidence, or historical facts to make screens look complete. |
| No duplicate profile model | Use auth.users metadata for email/name/avatar and user_preferences for product preferences. Do not create a redundant profiles table solely for identity. |
| No behavioral dashboard in Profile | Profile is identity/context, not a statistics screen. |
| No BottomTabNavigator replacement | The main pager is part of the product experience and should remain unless intentionally redesigned. |
| No colors.ts | Colors belong to the existing Uniwind theme; new feature modules should reuse semantic tokens. |
| No provider coupling | MirrorCore and domain services must not know whether the AI provider is Foundry, OpenAI, Anthropic, Gemini, or local. |
| No notification spam | Notifications are selective delivery. “Only when it matters.” |
| No timeline intelligence engine | Timeline is a projection/read layer. |
| No subscription truth in Supabase/client | RevenueCat remains entitlement authority. |
| Logout is not deletion | Account deletion requires explicit destructive flow and backend confirmation. |
| Mascot is future | The mascot should remain a separate presentation layer until core product architecture is stable. |
| No forced timezone/language persistence yet | Persist only when product behavior actually needs server-side scheduling or localization state. |

# 31. UI Prompt Pack

The following prompts are canonical UI prompts derived from the design direction we established. They are intentionally written so they can be pasted into a coding agent. Each prompt should be used with the rule: inspect existing code first, change only what is necessary, reuse existing components, and do not fabricate data.

# 31.1 Master UI Prompt

Build the Aks UI using a calm, soft, premium, spacious, text-first visual language. Reuse the existing AppText, Button, IconButton, Hugeicons, cn(), Uniwind 1.12.0 theme, and existing navigation. Do not create colors.ts or another TypeScript theme file. Avoid giant decorative hero icons above titles. Use functional icons inside rows/cards. Use subtle Reanimated motion only where it improves clarity. Do not introduce streaks, badges, fake scores, guilt, urgency, fake data, or generic chatbot styling. Keep screens thin and move domain logic into existing services/hooks. Never fabricate user facts, history, patterns, insights, evidence, confidence, or outcomes.

# 31.2 Mirror UI prompt

Implement the Mirror screen as Aks’s primary behavioral conversation surface. Keep it calm and focused, not like a generic chatbot. Support text, voice, and check-in submissions. The composer should have a keyboard/input affordance on the left, X in the center, and an action/menu area on the right; when empty, show mic, when text exists show send. Keyboard opens the composer and focuses input. X closes/clears composer state without deleting conversation history. Menu exposes New conversation and Conversation history. Reuse AppText, Hugeicons, Uniwind, existing buttons, and subtle motion. Do not add fake AI replies. Use the existing MirrorCore/submit boundary for real responses.

# 31.3 Timeline UI prompt

Implement Timeline as a personal chronological story, not an activity log. Header “Timeline” with a short calm supporting line. Provide filters All, Insights, Experiments, Check-ins, Decisions. Group events by TODAY, YESTERDAY, THIS WEEK, OLDER. Use meaningful icons, title, supporting text, time, optional status, and navigation affordance when real destinations exist. Prefer FlatList/virtualization. Empty state: “Your story starts here.” Do not show fake entries, scores, streaks, or analytics dashboards.

# 31.4 YouHome UI prompt

Design YouHome as a personal control and understanding hub. Keep it spacious and text-first. Surface Patterns, Experiments, Learnings, Your Data, Notifications, Appearance, Privacy, Help & Feedback, and Settings without turning the page into an analytics dashboard. Use compact rows/cards and functional icons. Do not place behavioral stats or vanity metrics here unless explicitly part of a separate real feature.

# 31.5 Patterns UI prompt

Design Patterns around candidate relationships supported by evidence. Show title, short explanation, status, and evidence context. Use uncertainty-aware language and avoid declaring psychological facts. Let users open supporting evidence where the product already supports it. Keep cards calm and readable; avoid scores and gamification.

# 31.6 Experiments UI prompt

Design Experiments as hypothesis-testing, not habit tracking. Show active/completed state, hypothesis, what is being observed, recent observations, and outcome when available. Provide clear start/update/complete actions. Do not add streaks or completion percentages. Use real records only.

# 31.7 Learnings UI prompt

Design Learnings as a quiet collection of what Aks has learned from evidence. Show title, explanation, confidence language only when useful, evidence count when meaningful, and source experiment/pattern navigation where available. Let learnings feel revisable, not like permanent labels.

# 31.8 Insights UI prompt

Design Insights as selective things worth noticing now. Use title, concise explanation, evidence/context link, and seen/dismissed state. Avoid overloading the user with every possible insight. Do not fabricate insights. Make the difference between insight and notification visible through interaction and navigation.

# 31.9 Notifications UI prompt

Keep the existing Notifications page and connect it to real preferences/history. Preserve “Only when it matters.”, Allow notifications, New insights, Experiment updates, Check-in reminders, Weekly reflection, quiet hours, preview examples, and A Note From Aks. Add device settings shortcut when needed. No guilt, urgency, streaks, or aggressive badges.

# 31.10 Privacy UI prompt

Design PrivacyHome as a user control center. Keep it text-first. Include Data Usage, Data Access, Export Data, Delete Data, Privacy Policy. Explain user-provided vs derived information in simple language. Do not expose technical secrets or internal AI details. Destructive actions must be deliberate and truthful to backend behavior.

# 31.11 Subscription UI prompt

Design Subscription with RevenueCat-backed offerings. Show actual localized price and billing period from product metadata. Clearly show current entitlement. Provide purchase, restore, and manage subscription actions where supported. Never hardcode price/trials or fake premium status. Keep the paywall calm and aligned with Aks, without scarcity or urgency.

# 31.12 Profile UI prompt

Keep Profile focused on identity and context: avatar, name, email, what the user is exploring, and what Aks should notice. Do not add check-in counts, patterns, insights, behavioral scores, or streaks. Reuse existing avatar components and Supabase identity metadata.

# 31.13 Settings UI prompt

Keep Settings compact: Profile, Subscription, About, Account. Do not duplicate Notifications, Appearance, Privacy, Your Data, or Help & Feedback here because they already have direct entries under You.

# 31.14 Help & Feedback UI prompt

Implement HelpFeedbackHome, FAQ, ReportProblem, and SendFeedback. FAQ uses search and expandable answers. Report categories: Something is not working, App crashed, Incorrect insight, Data issue, Notification issue, Other. Send Feedback types: Idea, Feature request, General feedback, Something I liked. Do not store support requests as behavioral memory.

# 31.15 Account UI prompt

Keep Account focused on sign out and account deletion. Make the difference explicit. Sign out should end session; Delete Account should use the authenticated server-side deletion flow with multi-step confirmation. Never pretend a logout deletes data.

# 31.16 Legal/Privacy Policy UI prompt

Use the existing shared LegalWebView for Terms and Privacy Policy. Privacy Policy URL is https://hirixa.vercel.app/privacy. Do not build a second legal renderer or duplicate the policy text in the screen.

# 32. Shipaton 2026 Opportunity Map

As of 18 September 2026, official Shipaton 2026 materials state that the hackathon submission deadline is 30 September 2026 at 11:45 PM PDT. The official rules require a working app using RevenueCat to power at least one in-app or web purchase, or RevenueCat Ads, with the first public store release during the submission period for non-Next-Gen entries. Required submission materials include a written description, a public demo video under two minutes, store URL where required, a 1024x1024 icon, and at least one 1179x2556 screenshot without a device frame. The Next Gen Award has a student-specific path using video and open-source code rather than a store listing.

The project has several documented routes that fit the published categories. This section maps Aks to those criteria without predicting that it will win. The strongest mapping depends on what is actually shipped, what is demonstrated in the video, and what evidence/traction exists by submission time.

| Category | Official focus | Aks case to build |
| --- | --- | --- |
| Next Gen Award | Student builders | Aks has a clear student-builder story if the entrant is eligible. The product is original, useful, technically substantial, and demonstrates thoughtful product architecture. This category specifically evaluates idea clarity, meaningful working progress, RevenueCat usage, technical choices, and presentation. |
| RevenueCat Design Award | Product craft, design, animation | Aks has a calm distinctive visual language, custom horizontal pager, text-first behavioral surfaces, subtle Reanimated motion, and a future mascot interaction concept. To make this credible, the shipped build needs polished transitions, a clean first-run experience, and a strong two-minute visual demo. |
| RevenueCat Peace Prize | Positive social impact | Aks can be framed around helping people develop better self-awareness and making reflection more actionable. The strongest case requires a clear target user problem, measurable or demonstrable benefit, and a credible explanation of feasibility rather than simply calling the product “mental health”. |
| HAMM Award | RevenueCat monetization | Aks has a natural subscription model because longitudinal understanding, deeper insights, experiments, and history are product capabilities that can be packaged over time. A strong entry must demonstrate a coherent paywall, pricing strategy, real RevenueCat integration, and actual monetization results/strategy rather than simply having a subscription screen. |
| #BuildInPublic Award | Development journey | The project has a strong architecture story that can be shared publicly: building Mirror, the evidence pipeline, Supabase foundation, AI provider abstraction, privacy controls, and RevenueCat integration. The category explicitly values the journey, community engagement, and what changed because of public feedback. |
| Grand Prize | Traction and growth momentum | This is not a design-only argument. It depends on real release timing, installs/users/payments/retention and documented growth experiments. The app architecture supports a story around experimentation and iteration, but actual traction must be generated and measured during the event window. |

## What the official rules mean for the build

- RevenueCat SDK integration is not optional for standard store-eligible entries; at least one in-app or web purchase, or RevenueCat Ads, must be powered through the SDK.

- The first public store version must be released during the eligible window for non-Next-Gen paths.

- The demo video should communicate the elevator pitch, show the app in use, and explain why the selected categories fit. RevenueCat says screeners focus on the first two minutes.

- For HAMM, the submission asks for a monetization strategy and results, including pricing/paywall approach and conversion or revenue numbers when available.

- For #BuildInPublic, public posts and a short explanation of how building publicly improved the app are required for consideration.

- For the Next Gen student route, open-source code and a clear working project demonstration are part of the category path.

# 33. Shipaton Submission Strategy and Demo Story

The product should not try to be every category at once. Shipaton’s published judging guidance says screeners review the first two minutes of the submission video, the written description, and the answers to selected categories. Judges score each category from 1 to 5 for the categories the submission targets, and final deliberation revisits the description, video, screenshots, and a real app download for eligible store submissions. This means the submission should tell one coherent story rather than presenting Aks as a bag of unrelated screens.

## Recommended two-minute story structure

- 0:00-0:15 - Hook: “Most people remember moments. Aks helps you notice what repeats.” Show Mirror immediately.

- 0:15-0:40 - Input: quickly show a real reflection/check-in/voice interaction. Make the experience feel human and effortless.

- 0:40-1:00 - Understanding: show how the same input becomes a signal and eventually contributes to a possible pattern/insight. Keep the evidence trail visible.

- 1:00-1:20 - Experiment: show a hypothesis, observation, and outcome to make the product loop tangible.

- 1:20-1:35 - Return to user: show Insight + Timeline as the system giving the learning back to the user.

- 1:35-1:50 - Monetization: briefly show the RevenueCat paywall/subscription flow and actual entitlement state.

- 1:50-2:00 - Close: show the Aks identity, tagline, and the reason the product is different from a diary or generic AI chat.

For Design, the first minute should visually communicate polish. For Peace Prize, the story should communicate a concrete benefit and target audience. For HAMM, show the paywall and the business model with real figures if available. For Next Gen, emphasize the originality and technical depth of the system. For #BuildInPublic, maintain public posts during development rather than reconstructing the journey only after completion.

# 34. Production Readiness Checklist

## Product

- Core Mirror loop works on real data.

- No fake AI responses or hardcoded behavioral history.

- Patterns, experiments, learnings, insights have evidence chains.

- Timeline reflects real domain events.

- Notifications are selective and respect preferences/quiet hours.

- Privacy and deletion wording matches actual backend behavior.

## Backend

- All migrations applied.

- RLS verified table-by-table.

- Child tables verify parent ownership.

- Delete-account Edge Function deployed and tested.

- Export path is authenticated and secure.

- Storage policies verified for user avatars/files.

## AI

- AI Service is provider-neutral.

- Provider adapter contains provider-specific code.

- Structured output validation exists.

- Retry/idempotency strategy prevents duplicate derived data.

- AI observability does not leak private content unnecessarily.

## Monetization

- RevenueCat SDK configured for target platforms.

- Products and entitlement configured.

- Offerings load from real store metadata.

- Purchase and restore tested in sandbox/Test Store as appropriate.

- Premium access depends on verified entitlement.

## Shipaton

- App first public store release falls within eligible window where required.

- RevenueCat requirement satisfied.

- Demo video under two minutes.

- 1024x1024 icon ready.

- 1179x2556 screenshot without device frame ready.

- Devpost description and category answers complete.

- Public app store URL ready for standard categories.

- Public build-in-public links collected if targeting that category.

# 35. Final Product Definition

Aks is a living personal mirror. The user does not simply feed it prompts; they gradually build a body of evidence. The system listens through Mirror, stores the raw source, structures observations, detects possible relationships, remembers selectively, tests hypotheses, measures what happened, extracts learnings, and surfaces useful insights. Timeline lets the user look backward at this evolving story. Notifications bring selected moments back to attention. Privacy gives the user control over the underlying data. Subscription provides a sustainable business model through RevenueCat. The future mascot turns semantic state into an emotional visual identity without becoming the intelligence itself.

The strongest version of Aks is therefore not the version with the most screens. It is the version where the screens are connected by one coherent idea: what the user shares today should help them understand tomorrow, but every claim should remain grounded in evidence and every interaction should preserve human agency.

| North-star experience <br> The user talks to Mirror. Aks notices something real. The system preserves the evidence. A possible pattern becomes testable. The user learns something. Aks remembers the learning. Later, Aks reflects it back at the right moment. Then the loop begins again. |
| --- |

# Appendix A - Canonical Copy and Phrases

| Context | Canonical / example copy |
| --- | --- |
| Brand line | Understand yourself, differently. |
| Mirror role | I’ll help you notice what repeats, what changes, and what might be worth testing. |
| Timeline supporting line | A quiet record of things worth noticing. |
| Timeline empty state | Your story starts here. |
| Notifications intro | Only when it matters. |
| Notifications weekly preview | A week worth noticing. A few things became clearer this week. |
| Notification insight preview | Aks noticed something. Your focus has been different on quieter mornings lately. |
| Privacy idea | Your data belongs to you. |
| Privacy policy URL | https://hirixa.vercel.app/privacy |

Copy that contains behavioral interpretation should be dynamically generated from real records where it claims user-specific facts. Static preview text is allowed only when clearly presented as a preview/example rather than history.

# Appendix B - Technical Quick Reference

## Frontend stack

```text
React Native + Expo
Uniwind 1.12.0
Reanimated
React Navigation native stacks
Hugeicons
AppText
Custom horizontal main pager
```

## Backend stack

```text
Supabase Auth
Supabase Postgres
RLS
Storage
Edge Functions
Realtime where useful
```

## AI stack

```text
MirrorCore
  → AI Service
    → AI Provider Adapter
      → Current provider (replaceable)
```

## Billing stack

```text
React Native
  → Subscription Hook
    → Subscription Service
      → RevenueCat SDK
        → Store / RevenueCat entitlement
```

## Main pager

```text
Index 0 = Timeline
Index 1 = Mirror
Index 2 = You
Mirror is the centered/default page
```

## Privacy navigation

```text
PrivacyHome
DataUsage
DataAccess
ExportData
DeleteData
PrivacyPolicy
```

## Help & Feedback navigation

```text
HelpFeedbackHome
FAQ
ReportProblem
SendFeedback
```

## Settings

```text
Profile
Subscription
About
Account
```

# Appendix C - Sources

The product architecture and UX portions of this report are a consolidation of decisions and prompts established in the project conversation. The Shipaton-specific facts below were verified against official 2026 Shipaton/RevenueCat sources on 18 September 2026.

Shipaton 2026 official home - https://www.shipaton.com/

Shipaton 2026 official rules (Devpost) - https://revenuecat-shipaton-2026.devpost.com/rules

Shipaton 2026 judging overview - https://www.shipaton.com/blog/how-we-judge-shipaton

Shipaton 2026 student / Next Gen information - https://www.shipaton.com/students

RevenueCat Shipaton 2026 preparation guide - https://revenuecat.github.io/codelabs/shipaton-2026-prep.html

Shipaton status note: dates, categories, requirements, and judging details can change under the official rules. The report therefore treats the official sources as the current snapshot at the document date, not a permanent guarantee.
