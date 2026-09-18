Haan bhai. Ab tak jo Aks architecture, screens, navigation, retention loop, privacy/data philosophy, aur current UI decisions humne establish kiye hain, unko ek **single product interaction blueprint** mein lock kar dete hain.

# Aks.ai — Complete Screens, Interactions & Behaviour

## 1. Product Core

Aks ka main loop:

**Observe → Structure → Notice Pattern → Validate → Experiment → Measure → Learn → Observe again**

User ka kaam mostly **bolna / tap karna / confirm karna** hai.

Aks ka kaam:

* information organize karna
* recurring signals detect karna
* evidence dikhana
* uncertainty clearly communicate karna
* hypotheses suggest karna
* experiments propose karna
* outcomes track karna
* learnings retain karna

Aks ko kabhi diagnosis machine ya generic advice chatbot jaisa behave nahi karna chahiye.

---

# 2. App Launch Flow

```text
Splash
   ↓
App State Check
   ├── First-time user → Onboarding
   ├── Not authenticated → Auth
   ├── Authenticated + legal not accepted → Legal Acceptance
   └── Authenticated + ready → Main
```

### Splash

Visual:

* Aks logo
* Aks.ai
* “Understand yourself, differently.”

Behaviour:

* short branded animation
* app state load hoti hai
* returning user ko onboarding dobara nahi dikhna chahiye

---

# 3. Onboarding

## Slide 1

**YOUR LIFE LEAVES CLUES**

> You already leave clues about yourself.

Behaviour:

* swipe horizontally
* CTA advances to next slide
* no permission spam

## Slide 2

**DON'T JUST REFLECT**

> Don’t guess. Test it.

Explains experiments.

## Slide 3

**A CLEARER YOU**

> Become less of a mystery to yourself.

CTA:

`Get started`

Then:

```text
New user → Auth
Existing authenticated state → appropriate next state
```

---

# 4. Authentication

## Login

```text
Welcome back

Email
[ Sign in ]

We'll email you a secure sign-in link.
No password needed.

OR CONTINUE WITH

Google    Facebook
GitHub
```

Behaviour:

* email validation
* magic-link authentication
* social auth
* loading state
* error state
* no Forgot Password

Footer:

`Don’t have an account? Create one`

---

## Register

```text
Create your account

Name
Email

[ Create account ]

social login options
```

After successful registration:

```text
Register
 ↓
Legal Acceptance
 ↓
Personal Setup
 ↓
Mirror
```

---

# 5. Legal Acceptance

Purpose:
user explicitly accepts required legal documents.

UI:

* Terms
* Privacy
* checkbox
* continue CTA

Behaviour:

* CTA disabled until required agreement
* Terms opens legal page
* Privacy opens legal page
* accepted state is persisted

After acceptance:

`Main`

---

# 6. Main Navigation

Custom horizontal pager, **not bottom-tab navigator**.

```text
Timeline | Mirror | You
```

Default:

`Mirror`

Bottom navigation:

* animated entrance from bottom
* active icon emphasized
* horizontal swipe between main areas
* tapping a nav item changes page

---

# 7. MIRROR

This is the heart of Aks.

## First-time Mirror

```text
Hi, I’m Aks.

What would you like to understand about yourself?
```

Quick options:

```text
Focus
Energy
Sleep
Emotions
Routines
Relationships
Productivity
```

User can:

* tap
* speak
* type when appropriate

Aks asks very few questions.

### Key principle

User does not maintain a complicated diary.

Aks extracts structure automatically.

---

# 8. Mirror — Daily Behaviour

## When nothing unusual is detected

Don't invent insight.

Show:

> Nothing unusual today.

Then:

```text
How are you feeling?

Good
Okay
Chaos
```

User can add optional context.

---

## When Aks notices something

Main state:

> I noticed something.

Then:

```text
You seem to focus better
on slower mornings.

Why?
What?
Talk
Test
Dismiss
```

### Why?

Opens evidence.

Example:

```text
7 similar mornings
5 had higher focus

Confidence
Moderate
```

Aks wording:

> These mornings appear associated with better focus.

Never:

> Slow mornings cause better focus.

---

## What?

Explains the pattern.

## Talk

Opens conversational flow.

User can say:

> “Actually this only happens when I don't have meetings.”

Aks updates the context.

## Test

Creates experiment.

## Dismiss

Removes it from active attention but shouldn't necessarily erase historical evidence.

---

# 9. Voice Interaction

Mic:

```text
Tap → recording
Tap again → stop
```

Then:

```text
Listening...
 ↓
Understanding...
 ↓
Extracting relevant signals...
```

User doesn't have to manually classify everything.

Aks extracts things like:

* energy
* mood
* context
* activity
* sleep mention
* focus
* outcome

Only explicit user information should be treated as input.

---

# 10. Timeline

Timeline is chronological memory.

Structure:

```text
TODAY

10:42
You mentioned feeling focused after a slow morning.

Aks noticed
A similar pattern appeared 4 times.

────────────────

YESTERDAY

Check-in
Energy · Good

────────────────

MONDAY

Experiment started
Morning routine
```

Filters:

```text
All
Insights
Experiments
Check-ins
Decisions
```

### Behaviour

Each event can open detail.

Timeline is not just history; it shows Aks's evolving understanding.

Possible annotations:

* Pattern forming
* Interesting change
* Experiment active
* Outcome recorded

---

# 11. Story Mode / Weekly Reflection

Triggered from Timeline or weekly notification.

Example:

```text
Your week with Aks

You showed up most often
on days with structured mornings.

You tested:
Morning routine

You learned:
Less early friction helped you begin faster.

What changed?
```

Goal:
turn raw events into a meaningful story.

---

# 12. PATTERNS

Current architecture:

```text
You
 → Your Data
   → Patterns
```

This is a data-category screen.

Current pattern examples:

```text
Unscheduled mornings

Your focus often feels clearer on mornings
with fewer early commitments.

Based on recent entries
```

```text
Movement and energy

Brief walks often appear near check-ins
where your energy improved.

Possible pattern
```

```text
Task size and momentum

Smaller first steps may make difficult tasks
easier to begin.

Worth exploring
```

### Pattern states

```text
Forming
Interesting
Discovered
Tested
Learned
```

### Tap pattern

Opens Pattern Detail.

---

# 13. Pattern Detail

```text
Unscheduled mornings

Aks keeps noticing this connection.

WHAT AKS NOTICED

Your focus often feels clearer on mornings
with fewer early commitments.

EVIDENCE

8 similar mornings
6 had above-average focus

WHAT THIS MIGHT MEAN

Fewer early commitments may leave more
mental space for focused work.

This is a possibility, not a certainty.
```

Then:

```text
WHAT DO YOU THINK?

This feels true
I'm not sure
Not really
```

Then:

`Test this pattern →`

---

# 14. EXPERIMENTS

Experiments are **not a main bottom-nav destination**.

They emerge from a pattern/insight.

Flow:

```text
Pattern
 ↓
Test it
 ↓
Experiment setup
```

## Experiment setup

```text
Let's test it.

Hypothesis
I focus better when mornings are slower.

Change
Avoid scheduling meetings before 10 AM.

Duration
7 days

Outcome to watch
Focus
```

CTA:

`Start experiment`

---

# 15. Active Experiment

```text
Morning routine

Day 4 of 7

Today's check-in

Focus
Low ────●──── High

Energy
Low ────●──── High
```

Keep interaction tiny.

Optional voice/context input.

### Behaviour

Aks tracks:

* intervention
* daily signal
* outcome
* missing days

No guilt.

Never:

> “You missed today's experiment!”

Instead:

> “No check-in recorded today.”

---

# 16. Experiment Completion

At end:

```text
Experiment complete

You tested:
A slower morning

What happened?

Focus was higher on 5 of 7 days.
```

Then:

```text
What do you think?

It helped
It didn't help
Not sure
```

Aks generates cautious conclusion:

> The experiment suggests slower mornings may have helped your focus.

Then:

`Save learning`

---

# 17. LEARNINGS

```text
You
 → Your Data
   → Learnings
```

Learning card:

```text
Slower mornings may help
me focus.

Learned from:
Morning routine experiment

Confidence:
Moderate
```

Tap → detail.

Learning detail shows:

* original hypothesis
* experiment
* evidence
* outcome
* user interpretation
* date learned

Learning is persistent memory.

---

# 18. YOUR

You screen is the user's personal control / understanding hub.

Current conceptual structure:

```text
You

Profile

What Aks knows
7 patterns discovered

What you're exploring
Focus · Energy · Sleep

Things you haven't noticed
3 new discoveries
```

Then:

### JOURNEY

```text
Patterns
Experiments
Your data
```

### PREFERENCES

```text
Notifications
Appearance
Privacy
```

### SUPPORT

```text
Help & feedback
```

Footer:

```text
Aks.ai
Understand yourself, differently.
```

---

# 19. Your Data

Purpose:

**What does Aks remember about me?**

### Intro

> What Aks remembers.

### At a glance

```text
Reflections      24
Check-ins        38
Patterns          7
Experiments       3
Learnings         5
```

These should be real backend values once connected.

### What Aks knows

```text
Reflections
Patterns
Experiments
Learnings
```

### Your controls

```text
Export your data
Delete your data
```

### Data sources

Explain:

* what user provides
* connected sources
* only actual supported integrations

### User control card

> You decide what stays.

Navigate to Privacy.

---

# 20. Privacy

Privacy is **not the Privacy Policy**.

Privacy screen = in-app privacy control center.

```text
Privacy

YOUR PRIVACY

Your life is yours.

Your data
What Aks knows
What Aks can access

DATA CONTROLS
How your data is used
Export your data
Delete your data

LEGAL
Privacy Policy
```

No decorative hero icon above title.

---

# 21. Privacy Subroutes

```text
Privacy
├── PrivacyHome
├── DataUsage
├── DataAccess
├── ExportData
├── DeleteData
└── PrivacyPolicy
```

## Data Usage

Explains:

* reflections
* check-ins
* pattern detection
* experiments
* AI-assisted understanding

Avoid unsupported claims.

---

## Data Access

Explains:

* information user provides
* account information
* experiment data
* connected sources

Don't claim access to:

* contacts
* location
* microphone history
* health data

unless implemented.

---

## Export Data

```text
Take your data with you.

Request a copy
```

Future:
Supabase-powered real export.

Until then:
don't fake successful export.

---

## Delete Data

Destructive screen.

```text
Delete your data

This action cannot be undone.

[ confirmation ]

Delete my data
```

Before deletion:

confirmation modal.

```text
Cancel
Delete permanently
```

Real implementation later.

---

# 22. Notifications

Purpose:

**Control what Aks is allowed to interrupt you about.**

Existing controls must remain:

### Master switch

`Allow notifications`

### Notification types

```text
New insights
Experiment updates
Check-in reminders
Weekly reflection
```

### Quiet hours

```text
10:00 PM – 8:00 AM
```

### Notification preview

Examples:

> I noticed something about yesterday.

> Your experiment has 2 days left.

> You may have learned something this week.

### Device settings

Open system notification settings.

### Philosophy

No:

* streak guilt
* “we miss you”
* unnecessary daily spam
* manipulative retention notifications

Notifications should mainly communicate **something Aks discovered or something relevant to an active experiment**.

---

# 23. Appearance

```text
Appearance

Make it feel like yours.

Choose how Aks looks throughout the app.

THEME

System
Light
Dark
```

Current UI can have local selection initially.

Later connect to global theme state.

No hero icon.

---

# 24. Help & Feedback

## Home

```text
Help & feedback

We’re listening.

Need a hand?
Contact support →

GET HELP

FAQ
Report a problem

MAKE AKS BETTER

Suggest an idea
Send feedback

CONTACT

support@aks.ai
```

Clean, content-first.

---

# 25. FAQ

```text
Help & feedback

Frequently asked questions

Search

POPULAR QUESTIONS

How does Aks find patterns?
How does Aks use my data?
How do experiments work?
Can I delete my data?
...
```

Interaction:

* tap question
* expand answer
* tap again → collapse
* search filters results
* clear search
* no-results state
* “Still need help?” CTA

No giant decorative hero icon above title.

---

# 26. Report Problem

```text
What went wrong?

Problem type

Something isn't working
App crashed
Incorrect insight
Data issue
Notification issue
Other
```

Textarea:

```text
Tell us what happened...
```

Optional email.

Submit disabled until meaningful description.

After submission:

```text
Thank you for helping improve Aks.
```

No fake backend submission claim.

---

# 27. Send Feedback

```text
Help shape Aks.

Idea
Feature request
General feedback
Something I liked
```

Textarea.

Optional email.

Submit.

Success:

> Your feedback matters.

Again, mock only until backend is connected.

---

# 28. SETTINGS

Settings should stay intentionally small because You already exposes the other areas.

```text
Settings

ACCOUNT

Profile
Subscription

ACCOUNT

Sign out

ABOUT

About Aks
Terms of Service
Privacy Policy

Version
```

Do **not** duplicate:

* Notifications
* Appearance
* Privacy
* Your Data
* Help & Feedback

---

# 29. Profile

Purpose:

Manage identity/account information.

Expected:

```text
Profile

Avatar

Name
Email

Account information

Save changes
```

Potential future:

* username
* timezone
* language

---

# 30. Subscription

RevenueCat-powered.

```text
Subscription

Aks Pro

Current plan
Renewal
Price

Manage subscription
Restore purchases
```

RevenueCat should be the billing source of truth.

---

# 31. About

```text
About Aks

Understand yourself, differently.

Version
Build

Terms of Service
Privacy Policy
```

Potential:

* licenses
* credits

Keep it simple.

---

# 32. Terms of Service

This is the **actual legal document**.

Use shared:

`LegalWebView`

URL:

`/terms`

It is not the same thing as Settings or Privacy UX.

---

# 33. Privacy Policy

Actual legal document.

Use shared:

`LegalWebView`

URL:

`/privacy`

Separate from in-app Privacy controls.

---

# 34. Back Navigation Rules

Nested navigation should own its own back stack.

Example:

```text
You
 → Your Data
   → Patterns
     → Pattern Detail
```

Back:

```text
Pattern Detail → Patterns
Patterns → Your Data
Your Data → You
```

Likewise:

```text
You
 → Privacy
   → Delete Data
```

Back returns to Privacy.

Don't push every screen into root navigation.

---

# 35. Global UI Behaviour

Across all Aks screens:

### Headers

Text-first.

```text
←  Page title
```

No decorative hero icon above page titles.

### Cards

Primary surface language:

```text
rounded-[28px]
border
bg-surface
```

### Icons

Functional icons belong **inside rows/cards**.

### Typography

Use:

`AppText`

not raw `Text`.

### Colors

Use existing Uniwind semantic tokens.

For native icon props:

`useResolveClassNames()`

### Animation

Subtle:

* FadeInDown
* FadeInUp
* small stagger
* quick interaction feedback

No excessive motion.

---

# 36. Data Behaviour

Aks should never fabricate personal understanding.

Hierarchy:

```text
Raw signal
 ↓
Observation
 ↓
Derived metric
 ↓
Pattern
 ↓
Hypothesis
 ↓
User validation
 ↓
Experiment
 ↓
Outcome
 ↓
Learning
```

Each stage should preserve uncertainty.

Examples:

**Bad**

> You are more productive when you sleep 8 hours.

**Good**

> On several days, higher-energy check-ins appeared after longer sleep.

Then:

> This may be worth testing.

---

# 37. Empty States

Never fill empty states with fake insights.

Examples:

### Patterns

> Nothing clear yet.

> Patterns will appear as Aks has enough observations to identify recurring signals.

### Experiments

> No experiments yet.

> When something feels worth testing, Aks can help you run a small experiment.

### Learnings

> Nothing learned yet.

> Your learnings will grow from the experiments you run.

### Timeline

> Your story starts here.

---

# 38. Error Behaviour

Every network/backend interaction should have:

```text
Loading
Success
Error
Retry
```

Never leave a blank screen.

For example:

```text
Unable to load this.

Please check your connection and try again.

Try again
```

---

# 39. Permission Philosophy

Don't ask for everything during onboarding.

Request permissions **at the moment they become useful**.

Example:

Notification permission:

```text
Aks noticed something.
Want Aks to notify you when something meaningful appears?
```

Then ask system permission.

Not during initial onboarding.

---

# 40. Retention Loop

The user should naturally move:

```text
Mirror
 ↓
Insight
 ↓
Pattern
 ↓
Experiment
 ↓
Outcome
 ↓
Learning
 ↓
Timeline
 ↓
New Insight
```

The return reason should be:

> **“Aks has something interesting to tell me.”**

Not:

> “I need to maintain my streak.”

---

# 41. The Complete Navigation Model

```text
ROOT
│
├── Splash
├── Onboarding
├── Auth
│   ├── Login
│   ├── Register
│   ├── Terms
│   └── Privacy Policy
│
├── Legal Acceptance
│
└── Main
    │
    ├── Timeline
    │
    ├── Mirror
    │   ├── Conversation
    │   ├── Insight
    │   ├── Evidence
    │   ├── Pattern
    │   └── Experiment
    │
    └── You
        │
        ├── You Home
        │
        ├── Patterns
        │   └── Pattern Detail
        │
        ├── Experiments
        │   └── Experiment Detail
        │
        ├── Learnings
        │   └── Learning Detail
        │
        ├── Your Data
        │   ├── Reflections
        │   ├── Patterns
        │   ├── Experiments
        │   └── Learnings
        │
        ├── Notifications
        │
        ├── Appearance
        │
        ├── Privacy
        │   ├── Data Usage
        │   ├── Data Access
        │   ├── Export Data
        │   ├── Delete Data
        │   └── Privacy Policy
        │
        ├── Help & Feedback
        │   ├── FAQ
        │   ├── Report Problem
        │   └── Send Feedback
        │
        └── Settings
            ├── Profile
            ├── Subscription
            └── About
                ├── Terms
                └── Privacy
```

## The one rule I'd keep pinned above the entire project

**Aks should not merely tell the user something about themselves. It should show why it thinks that, let the user challenge it, and help them test it.**

That is what makes the app feel like a **personal behavioral laboratory** rather than another journaling, AI-chat, or self-improvement app.
