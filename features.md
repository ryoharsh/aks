# Aks — How the App Works (short points)

A quick map of what happens under the hood when you do something in Aks.
Written as "you do this → the app does that". For onboarding and debugging.

---

## 1. Accounts & Auth
- You sign up/sign in → Supabase Auth issues a session; every table row you create is stamped with your user id.
- Every read/write passes Row Level Security (RLS) → you can only ever see your own data. User A cannot read User B's anything.
- Log out → session cleared; push identity detached so no cross-account notification leakage.

## 2. Mirror (conversation)
- You send a message → the message is saved first (`create_conversation_with_message` RPC, with a request id).
- Then the `mirror` Edge Function runs: it assembles context (recent messages, memories, patterns, experiments, learnings, connected-source observations) → asks the AI (provider-neutral service) → validates the reply → saves the assistant message.
- Retry uses the same request id → the server replays instead of duplicating.
- Crisis-safety phrases bypass AI entirely and return a fixed supportive response.

## 3. Signals → Memories → Patterns → Insights (the intelligence loop)
- Check-ins, reflections, and conversation turns produce **signals** — small factual observations ("check-in: Good", "focus difficulty mentioned").
- The **memory engine** reviews signals and may create/update/reject/archive **memories** (durable context like "works better with a clear next step"). Not every message becomes a memory.
- The **pattern engine** waits for repeated evidence (3+ occurrences) before proposing **patterns** ("X may appear together with Y" — association, never causation).
- **Insights** are generated only when evidence is strong enough, and each one keeps a link back to the evidence that produced it. You can always ask "why?" and get real sources.

## 4. Experiments → Learnings
- From a pattern you can start an **experiment** (draft → active → complete/cancel), with a hypothesis and dates.
- During the experiment you record **observations** (idempotent via request id).
- On completion the app computes **deterministic metrics** from real observations (never invented numbers) and writes an honest result summary.
- A **learning** may then be synthesized from the outcome ("defining the next action may help you start"). Learnings can be revised or archived when new evidence contradicts them.

## 5. Check-ins
- You tap Good/Okay/Chaos → saved through an RPC that is replay-safe (double-tap cannot create two rows).
- Each check-in also becomes a signal + a timeline event, so later pattern analysis can use it.

## 6. Reflections
- A reflection (voice or text) is saved raw first — the original wording is never replaced.
- AI extraction may pull structured signals from it, but the extraction never overwrites the source.

## 7. Timeline
- The timeline is a **projection** of meaningful events (check-in, reflection, pattern formed, experiment started/completed, learning, insight) — not one row per message.
- Conversations are curated so a busy day doesn't flood the list.

## 8. Personal Context (Connected Sources)
- Optional sources you can connect one-by-one (never "allow all"): location, calendar, reminders/tasks, screen time, photos, voice; plus OAuth providers (Google Calendar/Tasks, Todoist, Notion, GitHub, Slack, Email).
- Restricted sources (calls, messages, notification history) are marked honestly as unavailable/policy-restricted and are never requested.
- Each source explains WHAT Aks receives, WHAT is stored, HOW to stop.
- Connected sources are synced in bounded windows, normalized into **observations** (e.g., "travel, 45 minutes" — never raw GPS coordinates), deduplicated by stable ids, and only for sources currently connected.
- Meaningful observations become signals through a deterministic bridge; the intelligence engines stay in charge of any interpretation.

## 9. Mirror + context transparency
- When you mention plans/focus/whereabouts, Mirror pulls only **relevant** observations in a bounded time window — never your whole history.
- Aks never claims "I just know": it can answer "how do you know?" by naming the source ("you connected your calendar, and it showed…").
- Disconnecting a source stops collection immediately; "Delete imported data" removes only that source's observations — conversations and memories are untouched.

## 10. Notifications (delivery only)
- Your preferences (enabled? which categories? quiet hours?) are stored in `user_preferences` — the source of truth.
- Real events (insight created, experiment update, reminder due) go through a policy pipeline: preference check → quiet hours (timezone-aware, midnight-crossing safe) → freshness → dedup (unique event keys) → OneSignal delivery.
- Scheduled reminders cancel themselves if the thing already happened (checked-in already → no 7pm nag).
- Delivery records track sent/failed/opened states; retries are bounded and never spam.

## 11. Subscription
- Premium features are gated by RevenueCat entitlement state (server-verified), not a client boolean.

## 12. Data controls
- Export your data or delete your account from settings; deletion cascades all domain rows and detaches delivery identity.
- Deleting one source's imported data never deletes unrelated intelligence.

---

**Golden rules baked in everywhere:** your words, source observations, and Aks's inferences are kept as three separate things; numbers come from real data or not at all; correlation is never reported as causation; and Aks stays fully useful with zero sources connected.
