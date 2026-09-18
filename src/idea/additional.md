Implement the next set of PRODUCT-LEVEL ADDITIONAL FEATURES for Aks.

IMPORTANT:

The core Aks architecture and main features already exist:

- Auth
- Profile
- Data Foundation
- Mirror
- Realtime Voice Conversation
- Memory
- Patterns
- Experiments
- Learnings
- Insights
- Timeline
- Notifications
- Privacy & Data Control
- Subscription

Do not rebuild these systems.

Do not create competing versions of existing services.

The goal of this task is to make Aks feel like a complete, polished, intelligent personal conversation product.

The primary experience remains:

Talk to Aks
→ understand something
→ explore it
→ notice patterns
→ experiment
→ learn
→ continue the conversation

Keep the existing Aks philosophy:

“Understand yourself, differently.”

No gamification.
No streaks.
No fake scores.
No engagement manipulation.
No unnecessary UI complexity.

--------------------------------------------------
1. CONVERSATION HISTORY
--------------------------------------------------

Make conversation history a proper first-class feature.

Users should be able to:

- see previous conversations
- search conversations
- open conversations
- rename conversations
- archive conversations
- delete conversations
- start a new conversation

Use the existing:

conversations
messages

tables.

Do not create duplicate conversation storage.

Conversation list should show:

- title
- short preview
- relative/actual date
- optional subtle status

Do not show huge amounts of metadata.

Example:

Morning thoughts
“Been thinking about why I keep postponing...”
Today

Do not generate fake titles.

If automatic title generation is used, it must be derived from actual conversation content.

--------------------------------------------------
2. CONVERSATION SEARCH
--------------------------------------------------

Add search inside conversation history.

Search should be:

fast
simple
text-first

Search:

- conversation title
- message content

Respect authenticated user ownership.

Never return messages from another user.

If full-text search infrastructure already exists, reuse it.

Do not fetch every conversation/message to the client just to search locally if the dataset can grow significantly.

Show:

Search conversations…

Empty result:

“No conversations found.”

Do not fabricate suggestions.

--------------------------------------------------
3. MESSAGE ACTIONS
--------------------------------------------------

Add lightweight message actions where useful.

For user/assistant messages:

- Copy
- Share
- Retry response where valid

For user messages, optionally:

- Edit

Do not overload every message with visible buttons.

Show actions through a contextual menu / long press.

Do not add actions that the current backend cannot support correctly.

--------------------------------------------------
4. EDIT USER MESSAGE
--------------------------------------------------

Allow editing a previously sent user message when appropriate.

Behavior:

User selects Edit
→ message becomes editable
→ user changes content
→ submit

The system should then create a new assistant response based on the edited turn.

Do not silently mutate historical conversation in a way that makes the timeline confusing.

Choose one clean strategy:

- branch from the edited message
OR
- replace the current turn and regenerate subsequent assistant response

Do not create duplicate assistant responses.

Make the behavior deterministic.

--------------------------------------------------
5. REGENERATE RESPONSE
--------------------------------------------------

Add:

“Try again”

for the most recent assistant response where valid.

Regeneration must:

- use the same user turn
- create a new assistant response
- avoid duplicating the user message
- replace or version the assistant response consistently

Do not create multiple identical visible assistant messages accidentally.

Do not pretend a response was regenerated if the AI request failed.

--------------------------------------------------
6. COPY RESPONSE
--------------------------------------------------

Allow copying assistant text.

Use the native clipboard API already supported by the project.

Show a small confirmation:

“Copied”

Do not use large modal dialogs for this.

--------------------------------------------------
7. SHARE RESPONSE
--------------------------------------------------

Allow users to share a useful assistant response using the native share sheet.

Do not share:

- hidden metadata
- internal prompts
- system instructions
- AI provider information
- private internal IDs

Only share the user-visible response text and optional conversation context when explicitly intended.

--------------------------------------------------
8. IMAGE INPUT
--------------------------------------------------

Add optional image input to Mirror.

The user should be able to attach an image when it helps the conversation.

Examples:

- screenshot
- photo
- document image
- visual reference

Use the platform's existing image picker/camera capabilities.

Do not automatically upload images without user action.

The user should explicitly choose:

Camera
or
Photo Library

Do not store images permanently unless the product actually needs them.

Use secure storage/upload architecture.

--------------------------------------------------
9. DOCUMENT INPUT
--------------------------------------------------

Allow users to attach supported documents where technically appropriate.

Examples:

- PDF
- text document
- image

Use a provider-agnostic document ingestion layer.

Do not send giant documents blindly to the model.

Create a document processing pipeline:

file
→ secure upload
→ extraction
→ normalized content
→ relevant context
→ AI

Do not expose raw storage paths to the model.

Do not expose storage bucket internals to the UI.

--------------------------------------------------
10. MULTIMODAL CONVERSATION
--------------------------------------------------

Voice, text, image, and supported documents should belong to the same conversation.

Do not create separate:

voice conversations
image conversations
document conversations

Example:

User speaks:
“Can you explain what this means?”

User attaches screenshot.

Aks understands both in the same turn.

--------------------------------------------------
11. ATTACHMENT PREVIEW
--------------------------------------------------

Before sending an image/document:

show a compact preview.

Allow:

- remove attachment
- replace attachment

Do not upload immediately if the user is still composing the message unless required by the chosen architecture.

Do not make the composer huge.

--------------------------------------------------
12. VOICE CONTROLS
--------------------------------------------------

Extend the realtime voice experience with useful controls.

Support where platform/provider allow:

- mute microphone
- resume microphone
- speaker/audio output state
- stop Aks speaking
- reconnect
- end voice session

Do not turn these into a giant call dashboard.

Keep controls subtle.

IMPORTANT:

Mute means:

microphone stops being sent to the realtime AI session.

Mute does NOT terminate the conversation.

--------------------------------------------------
13. SPEECH TRANSCRIPT CONTROL
--------------------------------------------------

Provide a clear distinction between:

interim transcript
and
final transcript

Interim transcript:
transient

Final transcript:
conversation message

Never duplicate them.

If the provider supports confidence/alternatives, do not expose technical confidence values unnecessarily.

--------------------------------------------------
14. AUDIO OUTPUT CONTROL
--------------------------------------------------

Allow the user to stop current Aks audio.

Example:

Stop speaking

This should stop playback immediately without deleting the response.

The text response can remain visible.

The user can continue talking after playback stops.

--------------------------------------------------
15. VOICE / TEXT MODE MEMORY
--------------------------------------------------

When a user switches between:

voice
and
text

the conversation context must remain continuous.

Do not reset context.

Do not create duplicate sessions unnecessarily.

--------------------------------------------------
16. LANGUAGE SUPPORT
--------------------------------------------------

Prepare Mirror architecture for multilingual conversations.

Do not force a language selector into the main UI unless necessary.

The system should be able to naturally handle the language the user speaks/types.

Do not invent translation behavior.

The AI layer should remain provider-agnostic.

--------------------------------------------------
17. USER PREFERENCES FOR AKS
--------------------------------------------------

Use existing user preferences:

what user is exploring
what Aks should notice
appearance

Where appropriate, allow the user to adjust these from Profile/Settings.

Do not create duplicate preference tables.

Do not turn preferences into rigid instructions that override real conversation context.

--------------------------------------------------
18. MEMORY CONTROLS IN CONVERSATION
--------------------------------------------------

When Aks uses a meaningful memory, the UI may provide a subtle indication.

Example:

“Using something you shared earlier.”

Do not expose raw internal memory IDs.

Allow the user to understand that Aks remembered something.

Where appropriate, provide:

“Forget this”

which should connect to the existing Memory system.

Do not create a second memory store.

--------------------------------------------------
19. INSIGHT FEEDBACK
--------------------------------------------------

When an insight is surfaced, optionally allow simple feedback:

Helpful
Not useful

Do not turn this into a rating system.

Store feedback only if the current architecture supports it.

Do not create:

1–10 ratings
stars
scores

The goal is calibration, not gamification.

--------------------------------------------------
20. PATTERN FEEDBACK
--------------------------------------------------

When Aks proposes a possible pattern, allow:

“This feels accurate”
“Not really”
“Not sure”

These should update the existing pattern state/evidence workflow.

Do not automatically mark a pattern as confirmed just because the user taps a button.

User feedback is evidence, not unquestionable truth.

--------------------------------------------------
21. EXPERIMENT QUICK ACTIONS
--------------------------------------------------

When an active experiment is relevant in Mirror, allow a concise contextual action such as:

“Record observation”

This should connect to the existing Experiment system.

Do not duplicate experiment storage.

Do not turn Mirror into the Experiment screen.

--------------------------------------------------
22. INSIGHT DEEP LINKS
--------------------------------------------------

When Aks discusses an existing:

Pattern
Experiment
Learning
Insight

allow the user to open the relevant detail screen.

Only navigate when a valid reference exists.

Never fabricate navigation IDs.

--------------------------------------------------
23. SEARCH INSIDE CURRENT CONVERSATION
--------------------------------------------------

Add optional search within the current conversation when useful.

It should search:

message content

Show matching messages.

Use the existing conversation/message data source.

Do not load massive conversation history unnecessarily.

--------------------------------------------------
24. SMART SCROLL BEHAVIOR
--------------------------------------------------

Improve the current conversation scrolling.

During streaming:

auto-scroll only when the user is already near the bottom.

If the user manually scrolls upward:

do not keep forcing the list down.

Show a subtle:

“Jump to latest”

control when new messages arrive below the visible area.

Do not aggressively auto-scroll.

--------------------------------------------------
25. DRAFT PERSISTENCE
--------------------------------------------------

Preserve an unsent text draft when practical.

Examples:

user opens keyboard
types something
leaves temporarily
returns

Draft may remain.

Do not persist highly sensitive draft content remotely.

Use safe local state/storage if necessary.

Clear draft when the user explicitly sends or discards it.

--------------------------------------------------
26. OFFLINE EXPERIENCE
--------------------------------------------------

Improve Mirror behavior when network connection is unavailable.

The user should still be able to:

- view previously loaded conversation history
- read messages
- open local UI

When trying to send:

show:

“You’re offline.”

Do not pretend the AI responded.

Queueing messages for automatic AI sending can be avoided unless the backend architecture explicitly supports reliable offline queueing.

--------------------------------------------------
27. CONNECTION STATUS
--------------------------------------------------

Show realtime connection state only when useful.

Examples:

Connected
Reconnecting…
Offline

Do not show technical networking information.

The user should understand what is happening without seeing WebSocket/WebRTC terminology.

--------------------------------------------------
28. SESSION RECOVERY
--------------------------------------------------

If the realtime session dies:

preserve the conversation.

Allow:

Reconnect

Do not:
- lose the current conversation
- duplicate messages
- replay old audio
- create duplicate sessions

--------------------------------------------------
29. AI RESPONSE FEEDBACK
--------------------------------------------------

Add optional lightweight feedback:

Helpful
Not helpful

for assistant responses where appropriate.

Do not show it on every single streamed chunk.

Do not interrupt the conversation.

Do not create an ugly feedback bar under every message.

A contextual action menu is preferred.

--------------------------------------------------
30. REPORT INCORRECT RESPONSE
--------------------------------------------------

Provide a way to report an assistant response.

Example:

“Report response”

Possible reasons:

- Incorrect
- Misunderstood me
- Unsafe
- Other

Connect to the existing feedback/support architecture.

Do not create a separate support database if one already exists.

Do not store private content unnecessarily in support payloads.

--------------------------------------------------
31. AI CONTEXT TRANSPARENCY
--------------------------------------------------

When useful, let the user understand what Aks is using.

Examples:

“Based on this conversation”
“Based on something you shared earlier”
“Based on an active experiment”

Do not expose hidden system prompts.

Do not expose chain-of-thought.

Do not expose provider internals.

--------------------------------------------------
32. “WHY DID YOU SAY THAT?”
--------------------------------------------------

Allow the user to ask:

“Why do you think that?”

Aks should respond based on available evidence.

The response should reference:

- conversation context
- relevant user-provided information
- relevant validated domain data

Do not expose hidden reasoning or chain-of-thought.

Do not fabricate evidence.

--------------------------------------------------
33. “WHAT DO YOU REMEMBER ABOUT ME?”
--------------------------------------------------

Support a natural conversation request:

“What do you remember about me?”

Aks should respond using actual stored memory/context.

Do not invent memories.

Do not dump raw database records.

Provide a human-readable summary.

--------------------------------------------------
34. “FORGET THAT”
--------------------------------------------------

Support a natural request to forget a previously remembered item when the system can identify the relevant memory.

Flow:

User asks:
“Forget what I said about X.”

→ identify actual stored memory if possible
→ confirm when ambiguity exists
→ update existing Memory system

Do not delete unrelated data.

Do not silently delete raw conversation history just because a memory is forgotten.

Remember:

Memory deletion ≠ source conversation deletion.

--------------------------------------------------
35. CONVERSATION TITLE
--------------------------------------------------

Improve new conversation titles.

After enough conversation context exists:

generate or derive a concise title.

Title must reflect actual conversation content.

Examples:

“Why my mornings feel different”
“Thinking about work lately”
“Planning a better sleep routine”

Do not use:

“New Chat”
“Conversation 1”
“Chat with Aks”

unless there is not enough context.

--------------------------------------------------
36. SMART EMPTY STATE
--------------------------------------------------

For a new conversation:

keep the existing Aks welcome experience.

Do not add generic AI prompt chips like:

“Write an email”
“Write code”
“Tell me a joke”

unless those are genuinely part of Aks product strategy.

Aks should invite reflection and natural conversation.

--------------------------------------------------
37. LONG RESPONSE HANDLING
--------------------------------------------------

For long assistant responses:

- keep text readable
- avoid enormous paragraphs
- preserve streaming
- allow the user to interrupt voice
- avoid reading extremely long responses aloud automatically

For voice:

prefer conversational response length.

If the user wants detail:

Aks can provide more.

--------------------------------------------------
38. RESPONSE FORMATTING
--------------------------------------------------

Support readable assistant formatting:

- paragraphs
- short lists
- emphasis
- simple headings when useful

Do not over-format every response.

Avoid giant blocks of markdown.

The voice response should not literally speak markdown syntax.

--------------------------------------------------
39. SAFE URL / LINK HANDLING
--------------------------------------------------

If Aks returns URLs or links:

- make them tappable where safe
- use proper external/browser handling
- do not execute arbitrary URLs
- do not expose raw internal storage URLs

If web search is not currently implemented, do not pretend Aks searched the web.

--------------------------------------------------
40. CURRENT INFORMATION
--------------------------------------------------

Prepare the architecture for future tool use such as:

web search
weather
calendar
reminders
other external tools

But do NOT implement fake tools.

Aks must never say:

“I checked the weather”

unless an actual weather tool was invoked.

Aks must never say:

“I looked this up online”

unless real web search occurred.

Keep tools behind a provider/tool abstraction.

--------------------------------------------------
41. TOOL TRANSPARENCY
--------------------------------------------------

When tools are eventually implemented, MirrorCore should know:

tool_requested
tool_started
tool_completed
tool_failed

The UI can show a subtle state:

“Checking…”

“Looking that up…”

Do not expose technical tool names.

Do not fabricate tool execution.

--------------------------------------------------
42. APP LIFECYCLE
--------------------------------------------------

Mirror must correctly handle:

- app foreground
- app background
- screen focus
- screen blur
- logout
- user switch
- account deletion

Realtime microphone/audio/session resources must always be cleaned up appropriately.

--------------------------------------------------
43. SECURITY
--------------------------------------------------

All user data remains authenticated and user-scoped.

Do not trust client-provided:

user_id
conversation_id
message ownership
memory ownership
pattern ownership

Verify ownership in the backend/data layer.

Do not expose private data through navigation params.

Use stable IDs only for lookup; backend still verifies ownership.

--------------------------------------------------
44. PRIVACY
--------------------------------------------------

Do not retain more data simply because these features are added.

Especially:

- raw microphone audio
- image files
- document files
- temporary uploads
- drafts
- diagnostic payloads

Use minimal retention.

Clean temporary resources after processing when they are no longer needed.

--------------------------------------------------
45. PERFORMANCE
--------------------------------------------------

Do not turn Mirror into a giant stateful component.

Keep:

UI
→ useMirror
→ MirrorCore
→ domain services

Keep realtime audio/transcript state efficient.

Avoid:

- rerendering everything per audio chunk
- rerendering message history per token unnecessarily
- loading all conversations at once
- uploading huge files directly into model requests
- storing large binary blobs in React state

--------------------------------------------------
46. UI CONSISTENCY
--------------------------------------------------

Use the existing Aks visual language.

Reuse:

AppText
Button
IconButton
Hugeicons
Uniwind
cn()
existing card/row styles
existing navigation
existing hooks/services

Do NOT create:

colors.ts
new theme system
duplicate button system
duplicate typography system
duplicate modal system

No massive decorative hero elements.

No unnecessary illustrations.

--------------------------------------------------
47. ACCESSIBILITY
--------------------------------------------------

All interactive actions should have:

accessibilityRole
accessibilityLabel

Important actions:

- Start voice
- Stop voice
- Mute
- Send
- Attach image
- Attach document
- Copy
- Share
- Try again
- New conversation
- Search
- Delete
- Archive
- Reconnect

Voice state should not depend solely on animation.

--------------------------------------------------
48. TESTING
--------------------------------------------------

Test:

Conversation history
Search
Open conversation
Rename
Archive
Delete
New conversation

Message actions
Copy
Share
Retry
Edit

Realtime:
Voice
Text
Interruption
Mute
Resume
Stop playback
Reconnect

Attachments:
Image
Document
Remove attachment
Send multimodal message

Memory:
“What do you remember about me?”
“Forget that”

Pattern:
feedback

Experiment:
record observation

Insight:
open related insight
feedback

Network:
offline
reconnect

Lifecycle:
background
foreground
logout
account deletion

Security:
cross-user ownership tests

Performance:
large conversation
large history
long response
streaming

--------------------------------------------------
49. NO FAKE FEATURES
--------------------------------------------------

This is critical.

Do not implement placeholder behavior that pretends to be real.

Do not fake:

- web search
- weather
- calendar
- document understanding
- image understanding
- realtime voice
- memory
- pattern evidence
- experiment observations
- notifications

If infrastructure is missing:

create the correct integration boundary and clearly report what is still required.

--------------------------------------------------
50. IMPLEMENTATION RULE
--------------------------------------------------

Before changing anything:

inspect the existing codebase.

Find existing:

- MirrorConversationScreen
- useMirror
- MirrorCore
- realtime services
- AI Service
- AI provider adapter
- conversation repository
- message repository
- memory service
- pattern service
- experiment service
- learning service
- insight service
- notification service
- feedback/support service
- subscription service

Extend existing systems.

Do NOT create competing duplicate services.

--------------------------------------------------
FINAL GOAL
--------------------------------------------------

After this feature set, Aks should feel like:

A real personal AI conversation space

where the user can:

talk
type
interrupt
attach
search
look back
ask why
ask what Aks remembers
correct Aks
forget a memory
explore a pattern
record an experiment observation
open an insight
share useful responses

while maintaining one continuous conversation and one coherent personal understanding system.

The experience should remain:

CALM
NATURAL
FAST
PRIVATE
EVIDENCE-AWARE
REALTIME
PERSONAL

not:

BUSY
GAMIFIED
CORPORATE
GENERIC
CHATGPT-CLONED

--------------------------------------------------
FINAL OUTPUT
--------------------------------------------------

At the end report:

1. Features implemented.
2. Files/modules changed.
3. Existing services reused.
4. New services/interfaces created.
5. Backend changes.
6. Database changes.
7. Native dependencies added.
8. Environment variables added.
9. Features requiring external provider configuration.
10. Features not implemented because infrastructure is missing.
11. Tests run and results.
12. Any known limitations.

Do not claim a feature is complete unless its real backend/integration path works.