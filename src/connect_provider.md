Implement the Aks Personal Context & Observation system.

This is a MAJOR expansion of Aks.

The goal is to let Aks understand the user not only from what they explicitly tell Aks, but also from optional data sources that the user consciously connects and authorizes.

The product idea is:

User says:
“I planned to study today but somehow didn’t.”

Aks should eventually be able to understand more context such as:

- what happened before that
- where the user was
- whether they were moving/travelling
- whether there were calendar events
- whether they had relevant reminders/tasks
- whether they spent time in distracting contexts
- whether a connected source showed something relevant

Then Aks can ask a better question:

“You planned to study around 7. You were out around that time and got home much later. Was the problem really motivation, or did the day simply get away from you?”

IMPORTANT:

Aks must NEVER secretly monitor the user.

Everything must be:
- permission-based
- transparent
- revocable
- minimal
- user-controlled
- platform-compliant
- explainable

Aks should observe only what the user explicitly allows.

--------------------------------------------------
CORE ARCHITECTURE
--------------------------------------------------

Create a centralized Personal Context / Observation architecture.

Required flow:

Device / External Source
→ Permission Manager
→ Source Adapter
→ Context Normalizer
→ Observation Store
→ MirrorCore
→ Signal Engine
→ Memory / Pattern / Experiment / Insight

Conceptually:

React Native
↓
Context Hook
↓
Context Service
↓
Source Adapters
↓
Permissions
↓
Normalized Observations
↓
Supabase
↓
MirrorCore

Do NOT directly read device data from MirrorScreen.

Do NOT directly query location/call logs/calendar/etc from AI code.

Do NOT let AI providers access raw device APIs.

Provider-specific AI remains behind the existing AI Service.

--------------------------------------------------
IMPORTANT PRODUCT PRINCIPLE
--------------------------------------------------

Aks should distinguish between:

1. What the user explicitly said
2. What the device/source objectively observed
3. What Aks inferred from those observations

Never merge these into one category.

Example:

Observed:
“Location shows the user was at the office from 10:10–18:20.”

User said:
“I planned to leave work at 17:00.”

Possible inference:
“The delayed departure may have reduced evening time.”

Aks must NOT say:

“You were procrastinating.”

unless there is evidence supporting that conclusion.

Use:

“Your departure was later than planned.”

“Maybe that contributed.”

“Worth exploring.”

--------------------------------------------------
DATA SOURCE REGISTRY
--------------------------------------------------

Use the existing data_sources architecture if available.

Do NOT create one table per permission.

Create a normalized source registry.

Example source types:

- location
- calendar
- reminders/tasks
- screen_time/device_usage
- contacts
- calls
- messages
- notifications
- photos
- health/fitness
- app_activity
- microphone/voice_session
- other_supported_source

Only include sources that the current platform and application can legally/technically access.

Do NOT pretend a source exists on a platform where it is unavailable.

--------------------------------------------------
SOURCE STATES
--------------------------------------------------

Each source should have a state:

available
not_available
not_connected
permission_required
connected
temporarily_unavailable
revoked
error

Do not collapse all of these into a simple true/false.

This allows Aks to explain why a source is unavailable.

--------------------------------------------------
PERMISSION SYSTEM
--------------------------------------------------

Create a centralized permission manager.

Conceptually:

PermissionManager.getStatus(source)

PermissionManager.request(source)

PermissionManager.revoke(source)

PermissionManager.openSettings(source)

Do not request every permission when the user installs the app.

Ask only when a useful feature needs the source.

Permission onboarding should explain:

WHAT
WHY
HOW IT HELPS
WHAT IS STORED
HOW TO STOP IT

Example:

“Location”

“Let Aks understand where your day happens. This can help distinguish a difficult day from a day disrupted by travel or unexpected changes.”

Then:

Allow
Not now

Do not use manipulative copy.

--------------------------------------------------
PRIVACY-FIRST ONBOARDING
--------------------------------------------------

Create a dedicated Context & Permissions center.

Possible route:

You
→ Your Data
→ Connected Sources

or a dedicated:

Observation / Connections screen

The screen should show every available source.

Example:

Location
Optional
Not connected

Calendar
Optional
Connected

Calls
Unavailable on this device

Each source can open:

- explanation
- permission
- current status
- what Aks receives
- what Aks stores
- disconnect/revoke

--------------------------------------------------
NO “ALLOW EVERYTHING”
--------------------------------------------------

Do NOT create a single:

“Allow all permissions”

button.

Permissions are too sensitive.

Each source must be opt-in independently.

The user should be able to allow:

Location
without allowing:
Calls

Calendar
without allowing:
Contacts

etc.

--------------------------------------------------
DATA MINIMIZATION
--------------------------------------------------

Do NOT store raw source data unless necessary.

Prefer normalized observations.

Example:

Instead of storing an entire raw location history:

store meaningful observation windows such as:

source:
location

observedAt:
2026-09-18T18:30:00

context:
travel

placeCategory:
unknown

duration:
42 minutes

Only store the minimum data needed for Aks's observation use case.

Do not collect continuous high-frequency GPS unnecessarily.

--------------------------------------------------
LOCATION
--------------------------------------------------

Implement optional location context.

Possible modes:

1. While using Aks
2. Background observation where platform/product permissions allow it

Default should be OFF.

The user must explicitly enable background access.

Use platform-appropriate permission flows.

On iOS, location authorization distinguishes “when in use” and “always”; background location requires the proper capability/configuration. :contentReference[oaicite:2]{index=2}

Do NOT claim continuous background location will work identically on Android and iOS.

Use platform capability detection.

Prefer coarse/meaningful context when exact coordinates are unnecessary.

Examples:

- home area
- work area
- travel
- unfamiliar place
- stationary
- moving

Do not automatically expose precise coordinates to Aks when a coarse observation is sufficient.

--------------------------------------------------
LOCATION PRIVACY
--------------------------------------------------

If precise coordinates are not necessary:

do not store precise coordinates.

If exact coordinates are required for a specific feature:

explain why before requesting permission.

Provide disconnect/revoke.

After revocation:

stop collecting new location observations.

Do not imply historical data was automatically deleted unless it actually was.

--------------------------------------------------
CALENDAR
--------------------------------------------------

Implement optional calendar integration where platform APIs support it.

Possible observation:

calendar event:
“Study session”

planned:
19:00–20:00

actual user context:
not available / location changed / event cancelled / etc.

Use calendar only when authorized.

Do not upload full calendar contents unnecessarily.

Prefer minimal fields:

- event title only when needed
- start/end time
- calendar/source identifier
- relevant category

Avoid storing:
- attendee list
- descriptions
- private notes
- meeting links

unless a future feature explicitly requires them.

--------------------------------------------------
TASKS / REMINDERS
--------------------------------------------------

If platform permissions/API support tasks/reminders:

allow optional integration.

Use it to understand:

planned action
vs
observed outcome

Example:

Planned:
“Gym – 7 PM”

Observed:
user did not interact with task

DO NOT conclude:

“User skipped gym.”

Absence of evidence is not proof.

Instead:

“The planned gym session has no recorded completion.”

This distinction is extremely important.

--------------------------------------------------
CALL DATA
--------------------------------------------------

Treat call data as HIGHLY SENSITIVE.

IMPORTANT PLATFORM/POLICY CONSTRAINT:

Android call-log permissions such as READ_CALL_LOG are restricted by Google Play and generally require qualifying default Phone/Assistant/SMS-handler roles or a specific approved exception. Google Play explicitly lists personality profiling as an invalid call-log use case. :contentReference[oaicite:3]{index=3}

Therefore:

DO NOT implement blind:

READ_CALL_LOG

just because the user grants permission.

First:

- detect platform
- detect whether the app qualifies
- detect whether the required role/configuration exists
- verify Play policy compatibility

For iOS:

Do not assume arbitrary third-party access to the user's call history.

If the platform cannot provide call history access:

mark source as unavailable.

Do not build fake call data.

--------------------------------------------------
WHAT CALL DATA MAY MEAN
--------------------------------------------------

Do NOT record call audio.

Do NOT record conversations.

Do NOT intercept telephone calls.

Do NOT secretly monitor calls.

If a supported platform/API allows compliant call metadata:

possible minimal observations:

- incoming/outgoing
- approximate time
- duration
- contact label only when necessary

But only if:
- technically supported
- legally/policy allowed
- explicitly authorized
- genuinely necessary to Aks's core functionality

Do not use call data to profile other people.

Do not upload other people's private information unnecessarily.

--------------------------------------------------
CONTACTS
--------------------------------------------------

Treat contacts as highly sensitive.

Do not automatically import the entire address book.

Prefer contact lookup only when a user explicitly invokes a feature that needs it.

If contact context is ever used for observation:

store minimal identifiers.

Do not create a social graph.

Do not infer personality traits of the user's contacts.

--------------------------------------------------
MESSAGES / SMS
--------------------------------------------------

Do not automatically read SMS/messages.

Android SMS permissions are highly restricted and subject to Google Play policy.

Do not use SMS access for personality profiling.

Do not build an SMS scraping feature.

If messaging context is eventually supported:

use explicit user-selected messages/content rather than unrestricted background access where possible.

--------------------------------------------------
NOTIFICATIONS
--------------------------------------------------

Where platform support allows notification access, treat this as sensitive.

Do NOT build a generic “read all notifications forever” collector by default.

Prefer explicit integrations or source-specific APIs.

If notification access is unavailable:

do not fake it.

--------------------------------------------------
SCREEN TIME / DEVICE USAGE
--------------------------------------------------

If supported by the platform and product architecture:

allow optional aggregated device-usage context.

Prefer:

- total usage duration
- broad categories
- meaningful time windows

instead of:

every tap
every keystroke
every app event

Possible observation:

“High social-app usage occurred between 21:00–22:00.”

This may become a signal.

It is NOT automatically proof of distraction.

--------------------------------------------------
APP ACTIVITY
--------------------------------------------------

Do not monitor every app unnecessarily.

Only collect data that is necessary for an explicitly enabled observation feature.

Do not store raw activity logs forever.

Prefer aggregated observation windows.

--------------------------------------------------
PHOTOS
--------------------------------------------------

Do not continuously scan the user's photo library.

If an Aks feature needs a photo:

ask the user to choose it.

Use photo picker behavior where available.

Do not infer personal behavior from the entire photo library without explicit, meaningful consent.

--------------------------------------------------
HEALTH / FITNESS
--------------------------------------------------

Treat health data as highly sensitive.

Only implement if there is a clear product requirement and supported platform integration.

Do not request health permissions merely to make Aks “smarter”.

Do not infer medical conditions.

Do not make health claims.

If unavailable:

do not fake it.

--------------------------------------------------
MICROPHONE / VOICE
--------------------------------------------------

Voice conversation is already an explicit user action.

When realtime voice mode is active:

microphone can remain active for the session.

Outside voice mode:

microphone must be OFF.

Do not convert the microphone into a background passive listening sensor.

Do not record ambient conversations.

--------------------------------------------------
OBSERVATION MODEL
--------------------------------------------------

Create a normalized observation model.

Conceptually:

type Observation = {
  id: string;
  userId: string;
  sourceType: ObservationSourceType;
  observationType: string;
  observedAt: string;
  value: Record<string, unknown>;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

Keep values structured.

Examples:

location:
{
  context: "travel",
  durationMinutes: 45
}

calendar:
{
  eventCategory: "work",
  scheduledDurationMinutes: 60
}

call:
{
  direction: "outgoing",
  durationMinutes: 18
}

Do not make every observation an arbitrary blob with no schema.

--------------------------------------------------
RAW VS DERIVED
--------------------------------------------------

Keep the distinction:

Raw source data
→ normalized observation
→ signal
→ pattern
→ experiment
→ learning
→ insight

Do not skip directly from raw device data to an “insight”.

Example:

Raw:
calendar event at 19:00

Observation:
planned activity at 19:00

Signal:
evening plan existed

Pattern:
evening plans frequently change after workdays

Experiment:
try shorter transition window

Learning:
shorter transition window was easier to maintain

Insight:
weekday evenings appear easier when plans allow a transition period

Every stage needs evidence.

--------------------------------------------------
OBSERVATION ENGINE
--------------------------------------------------

Create an ObservationEngine that:

- receives source observations
- normalizes them
- validates schema
- deduplicates them
- stores them
- forwards meaningful observations to Signal Engine
- respects source permissions

Do not let ObservationEngine generate behavioral conclusions.

--------------------------------------------------
DE-DUPLICATION
--------------------------------------------------

Device data can repeat.

Prevent duplicates using:

source
+
event identifier
+
observed timestamp
+
stable hash where appropriate

Do not repeatedly create the same signal from the same source event.

--------------------------------------------------
BACKGROUND SYNC
--------------------------------------------------

Do not create unrestricted continuous background jobs.

Use platform-supported background execution.

Prefer periodic/batched sync when possible.

Example:

sync every reasonable interval
→ gather permitted observations
→ normalize
→ upload only new observations

Do not require second-by-second updates.

The user does not need that level of surveillance for Aks to be useful.

--------------------------------------------------
BATTERY
--------------------------------------------------

Aks must respect battery usage.

Do not:

- poll GPS continuously
- poll call logs continuously
- wake the app unnecessarily
- stream device data constantly

Use event-driven APIs and batched sync where available.

If a source is expensive:

explain that enabling it may increase battery usage.

--------------------------------------------------
DATA RETENTION
--------------------------------------------------

Do not automatically retain raw observations forever.

Define retention according to actual implementation.

If the product only needs aggregated signals:

allow raw observation cleanup after processing when safe.

Do not claim a retention period unless it is actually implemented.

--------------------------------------------------
USER CONTROLS
--------------------------------------------------

For every source show:

What Aks can access
Why it is useful
Current status
Last synced
Disconnect

Optional:

Delete imported data

If delete-source-data is implemented:

it should delete only the observations associated with that source.

Do not delete the user's conversations or unrelated Aks memories automatically.

--------------------------------------------------
SOURCE-SPECIFIC SETTINGS
--------------------------------------------------

Example:

Location
[Connected]

Aks can use location context to understand:
- travel
- changes in routine
- time spent away from normal places

Last synced:
Today

[Manage]

Do not show raw coordinates.

Calendar:
Connected

Calls:
Unavailable on this device
or
Not available for this app configuration

This must be truthful to platform capabilities.

--------------------------------------------------
MIRROR INTEGRATION
--------------------------------------------------

This system should improve Aks conversation.

Example:

User:
“I planned to work but couldn't.”

MirrorCore can access relevant observations:

planned calendar event
location change
travel observation

Aks may say:

“You had planned to work around 7, but you were still out at that time. Do you think the real issue was motivation, or did the evening simply get disrupted?”

This must be generated from real observed data.

Do not make Aks mention hidden telemetry.

Use natural transparency:

“I noticed that your evening looked different from what you planned.”

If the user asks:

“How do you know?”

Aks should explain:

“You connected your calendar and location, and those sources showed…”

The user should never feel secretly watched.

--------------------------------------------------
USER CONTROLLED CONTEXT
--------------------------------------------------

Aks should have a way to answer:

“What data are you using right now?”

Possible answer:

“I’m using this conversation and your connected calendar context. Location is currently off.”

This is extremely important for trust.

--------------------------------------------------
“STOP OBSERVING THIS”
--------------------------------------------------

Support a natural user command:

“Stop using my location.”

Flow:

MirrorCore
→ Context Service
→ disable source
→ stop future collection

Do not delete unrelated history.

--------------------------------------------------
“WHAT DO YOU HAVE ACCESS TO?”
--------------------------------------------------

Support:

“What can Aks access?”

Aks should summarize actual current permissions.

Example:

“You’ve allowed calendar and location. Calls aren’t connected. Microphone is only used during active voice conversations.”

Must be based on actual permission state.

--------------------------------------------------
“FORGET THIS DATA”
--------------------------------------------------

If the user explicitly asks to remove source-derived observations:

allow removal through the existing Privacy/Data Control system.

Do not delete conversation history unless separately requested.

Do not automatically destroy all derived intelligence unless the source data is required for that derived item and the existing deletion policy specifies it.

--------------------------------------------------
EVIDENCE TRANSPARENCY
--------------------------------------------------

When an insight/pattern uses contextual observations:

the existing evidence chain should remain:

Insight
→ Learning/Pattern
→ Evidence
→ Signal
→ Observation
→ Source

Do not break traceability.

The user should be able to understand where an observation came from.

--------------------------------------------------
NO CROSS-USER DATA
--------------------------------------------------

Aks must NEVER use another person's data to understand this user.

No shared profiling.

No cross-user inference.

No social graph intelligence.

All data remains user-scoped.

--------------------------------------------------
SECURITY
--------------------------------------------------

Source data is sensitive.

Use:

- authenticated access
- RLS
- secure storage
- minimal data collection
- encrypted transport
- no secrets in client
- no raw sensitive payloads in logs

Do not claim encryption/storage guarantees that are not actually implemented.

--------------------------------------------------
GOOGLE PLAY / APP STORE COMPLIANCE
--------------------------------------------------

This feature MUST respect platform policy.

For Android:

Call Log and SMS permissions are high-risk/restricted.

Do not include restricted permissions merely because they would make Aks smarter.

Only implement them when the app genuinely qualifies under current platform rules.

Google Play currently requires qualifying Call Log/SMS apps to meet specific role/use-case requirements and explicitly lists personality profiling as an invalid call-log use case. :contentReference[oaicite:4]{index=4}

If Aks cannot qualify:

DO NOT REQUEST THE PERMISSION.

Instead:
mark calls as unavailable
and provide alternative user-controlled inputs.

For iOS:

respect Apple permission/capability rules.

Do not claim access that the platform does not provide.

--------------------------------------------------
PERMISSION UX
--------------------------------------------------

Every permission request should happen at the moment of value.

Bad:

App launch
→ request 10 permissions

Good:

User opens:
“Help Aks understand how your day changes.”

→ explain location
→ user chooses Allow

Later:
“Connect your calendar?”

→ separate consent

--------------------------------------------------
NO DARK PATTERNS
--------------------------------------------------

Do not:

- repeatedly prompt after denial
- block the app until permissions are granted
- shame users for disabling sources
- make premium access depend on sensitive permissions unless explicitly designed and clearly explained
- hide disconnect controls
- make “Allow” visually coercive

Aks must remain useful even with zero connected sources.

--------------------------------------------------
OFFLINE / SYNC
--------------------------------------------------

Source observations may be gathered locally and synced when connectivity is available, provided the source permission permits it.

Do not silently fail.

Show sync state only when useful.

Avoid showing a technical sync dashboard.

--------------------------------------------------
PERFORMANCE
--------------------------------------------------

Do not place large observation datasets directly into React state.

Use repository/service layers.

Paginate historical observations.

Only load what a screen needs.

Do not send the entire observation database to the AI.

MirrorCore should retrieve relevant context only.

--------------------------------------------------
UI
--------------------------------------------------

Use existing Aks visual language.

Reuse:

AppText
Button
IconButton
Hugeicons
Uniwind
cn()
existing card/row patterns

No colors.ts.

No duplicate theme system.

No giant permission hero.

No scary security imagery.

The screen should feel calm and transparent.

--------------------------------------------------
DATA ACCESS PAGE
--------------------------------------------------

Enhance existing DataAccess so it becomes the source-control center.

For each source:

Name
Purpose
Status
Permission state
Last sync
Manage

Example:

Location
Optional
Connected

Calendar
Optional
Connected

Calls
Unavailable on this device

Contacts
Not connected

Do not expose raw sensitive records.

--------------------------------------------------
DATABASE
--------------------------------------------------

Prefer extending the existing data_sources architecture.

Create an observations table only if it does not already exist.

Possible:

observations
- id
- user_id
- source_type
- observation_type
- source_event_id
- value
- observed_at
- created_at
- metadata

Add indexes for:

user_id
source_type
observed_at

Use RLS.

Do not expose arbitrary cross-user observations.

--------------------------------------------------
SIGNAL INTEGRATION
--------------------------------------------------

ObservationEngine should forward only meaningful observations.

Example:

location:
travel

calendar:
planned_work

device_usage:
high_social_usage

These may become signals.

But the Signal Engine decides how/if they become candidate signals.

ObservationEngine should not create patterns.

--------------------------------------------------
AI INTEGRATION
--------------------------------------------------

AI should never directly query:

GPS
call logs
contacts
calendar
notifications
device activity

Instead:

MirrorCore requests an approved context bundle.

Example:

{
  conversationContext,
  relevantObservations,
  relevantSignals,
  memories,
  patterns,
  activeExperiments
}

Only include context necessary for the response.

--------------------------------------------------
CONTEXT SELECTION
--------------------------------------------------

Create a ContextResolver that determines:

Which observations are relevant to this conversation?

Example:

User:
“I couldn't focus this afternoon.”

Relevant:
calendar around afternoon
location change
recent contextual observations

Irrelevant:
last month's unrelated location history

Do not send irrelevant sensitive data to the model.

--------------------------------------------------
TRUTHFUL LANGUAGE
--------------------------------------------------

Aks must distinguish:

Observed:
“You were away from your usual location.”

Inferred:
“That may have changed your routine.”

Avoid:

“You were distracted because you were outside.”

unless evidence supports it.

--------------------------------------------------
TESTING
--------------------------------------------------

Test:

Permission:
- initial state
- allow
- deny
- revoke
- restricted
- unavailable
- open settings

Location:
- foreground permission
- background permission where supported
- disabled location services
- coarse/precise behavior
- sync
- cleanup

Calendar:
- permission
- events
- revoke
- partial access if platform supports it

Call source:
- supported
- unsupported
- policy-restricted
- permission denied

Observation:
- normalization
- deduplication
- persistence
- RLS
- pagination

Mirror:
- relevant observations included
- irrelevant data excluded
- source transparency

Privacy:
- disconnect stops future collection
- source-specific deletion works if implemented
- no unrelated data is deleted

Security:
- cross-user access fails
- raw sensitive payloads are not logged
- secrets never reach client

Performance:
- background sync reasonable
- no excessive battery polling
- large history remains performant

--------------------------------------------------
IMPORTANT FINAL RULE
--------------------------------------------------

Do not attempt to make Aks “all-seeing” by collecting everything available.

Make Aks “context-aware” by collecting only:

what the user explicitly allows
+
what the platform legitimately permits
+
what is genuinely useful
+
what can be explained to the user

The user's trust is part of the product.

Aks should be able to say:

“I noticed this because you connected your calendar.”

not:

“I just know.”

--------------------------------------------------
FINAL OUTPUT
--------------------------------------------------

At the end report:

1. Sources actually implemented.
2. Sources unavailable on Android.
3. Sources unavailable on iOS.
4. Permissions added.
5. Database changes.
6. Background tasks added.
7. Native configuration added.
8. Battery/privacy considerations.
9. Google Play/App Store restrictions encountered.
10. Exact sources that require special platform roles or approvals.
11. Which observations are stored.
12. Which raw data is intentionally not stored.
13. How MirrorCore receives relevant context.
14. Tests performed.
15. Features that require future native/platform work.

Do not claim “Aks can observe everything”.

Clearly distinguish:
SUPPORTED
SUPPORTED WITH PLATFORM CONDITIONS
NOT AVAILABLE
FUTURE