Perfect. I’ll treat this as a **product-definition and architecture exercise first**, not a coding task.

For **MIRROR**, I already have the core concept from our previous discussion, so I won’t make you repeat it. The working concept is:

> **MIRROR — Understand your patterns. Test what changes them.**

It observes user-provided/permissioned behavioral signals → detects patterns → explains the evidence → forms hypotheses → runs personal experiments → measures outcomes → learns what actually works for that individual.

Before I produce the huge developer specification, I want to lock down the decisions that materially affect the architecture.

## Phase 1 — Critical questions

### 1. Who is MIRROR primarily for?

Pick one primary audience for V1:

**A. Everyone / general consumers**
**B. Students**
**C. Engineers / developers**
**D. Corporate professionals / knowledge workers**
**E. Founders / entrepreneurs**
**F. Creators / freelancers**
**G. Other**

You can have secondary audiences, but I strongly recommend **one primary user persona** initially.

---

### 2. How much behavioral data should MIRROR actually access?

This is probably the biggest architectural decision.

**Level 1 — Private/manual**

* Text reflections
* Voice reflections
* Goals
* Decisions
* Projects
* Experiment results

**Level 2 — Device intelligence**
Everything above +

* Screen/app usage
* Focus sessions
* Notifications
* Device activity where APIs permit

**Level 3 — Connected life**
Everything above +

* Calendar
* Gmail/email
* Slack
* GitHub
* Notion
* Health/activity data
* Other integrations

My recommendation for the product vision: **Level 2 initially, with Level 3 integrations progressively added.**

---

### 3. Should MIRROR be primarily **mobile-only**, or should we eventually have a web/desktop companion?

For example:

```text
Mobile
→ reflection
→ notifications
→ timeline
→ experiments
→ quick insights

Web/Desktop
→ deep analysis
→ personal model
→ historical exploration
→ integrations
```

I think **mobile-first + optional web later** is stronger than trying to make everything work equally everywhere.

---

### 4. How proactive should MIRROR be?

There are two very different products:

**Passive MIRROR**

> User opens the app → asks questions → gets analysis.

**Proactive MIRROR**

> “Something changed this week.”

> “You repeated this pattern 6 times.”

> “Your experiment appears to be working.”

> “You said X, but your recent behavior suggests Y.”

> “I found something you may want to investigate.”

I strongly recommend **proactive, but restrained**. MIRROR should feel observant—not annoying.

---

### 5. Are we allowed to analyze sensitive personal information?

This matters enormously for the data model and privacy architecture.

Potentially sensitive information could appear in:

* reflections
* conversations
* email
* health/activity data
* relationships
* work data
* decisions

My recommendation:

**Yes, users can voluntarily provide sensitive data, but MIRROR should not diagnose medical/mental-health conditions or make high-stakes conclusions.**

Instead of:

> “You have anxiety.”

It says:

> “Your recent reflections contain substantially more mentions of stress than your baseline.”

Do you agree with this boundary?

---

### 6. What should be MIRROR's **signature capability**?

This is the biggest product differentiation question.

I see two possible directions:

#### Option A — Behavioral Intelligence

> **“See patterns in yourself that you can't see alone.”**

The killer feature is:

**What don't I know about myself?**

---

#### Option B — Personal Behavioral Laboratory

> **“Stop guessing what works for you. Test it.”**

The killer feature becomes:

**N-of-1 experiments**

Example:

```text
Hypothesis:
Context switching is hurting your work.

Baseline:
23 min uninterrupted work

7-day intervention:
Remove non-essential notifications

Result:
37 min uninterrupted work

MIRROR:
+61% focus duration
-34% context switching

Learning:
This intervention appears
effective for you.
```

### My recommendation: **B as the core, A as the discovery layer.**

That's considerably more defensible than simply building another “AI that understands you.”

---

### 7. How much automation do you want?

Should MIRROR automatically infer events from connected data?

For example:

```text
Calendar:
Meeting 10:00–11:00

Device:
YouTube → VS Code → Slack → VS Code

Reflection:
"I couldn't focus today."

MIRROR:
Possible context-switching pattern.
```

Or should users manually confirm most observations?

I'd recommend:

**Automatic detection → user-visible evidence → user can confirm/reject.**

Never silently turn an AI guess into a “fact.”

---

### 8. Should the app have a social component?

My default recommendation is **no social feed**.

But there could be lightweight sharing:

```text
MY MIRROR

Most productive hour
9:17 AM

Best intervention
Phone-free mornings

Focus improvement
+37%

[ Share ]
```

No raw personal data.

Would you want this growth mechanism?

---

### 9. Subscription model

Since this is being designed with Shipaton/RevenueCat in mind, should MIRROR be:

**A. Free + Pro subscription**

or

**B. Free trial → paid subscription**

or

**C. Freemium with limited experiments/history**

My recommendation:

### Free

* Reflections
* Basic timeline
* Basic patterns
* Limited experiments

### Pro

* Long-term behavioral model
* Advanced pattern detection
* Unlimited experiments
* Decision analysis
* Predictions
* Integrations
* Advanced historical analysis

The important part: **don't paywall the initial “aha.”** Let users experience the product before asking for money.

---

### 10. Authentication

Which should V1 support?

* Apple
* Google
* Email/password
* Email magic link
* Phone OTP

For a modern iOS/Android consumer app, I'd recommend:

**Apple + Google + email magic link**

No reason to add phone OTP unless there's a specific product need.

---

### 11. AI architecture

Are you comfortable with MIRROR using cloud AI APIs for processing?

Potential architecture:

```text
Mobile
   ↓
Backend
   ↓
AI abstraction layer
   ├── Extraction model
   ├── Embedding model
   └── Reasoning model
```

Sensitive raw data would remain under our controlled backend/data policy rather than putting AI API keys inside the mobile app.

---

### 12. Data retention

Which philosophy do you want?

**A. Store everything indefinitely**
**B. Store until user deletes it**
**C. Minimize raw data and retain derived patterns longer**

I'd recommend **C**:

```text
Raw event
     ↓
Derived observation
     ↓
Pattern
     ↓
Experiment result
```

Keep what's necessary for the user's model while minimizing unnecessary raw personal data.

---

## One important challenge to the original MIRROR concept

I don't want us to build:

> **“ChatGPT + journaling + habit tracker + screen-time dashboard.”**

That space is already crowded.

The product thesis I think we should lock onto is:

### **MIRROR is a personal N-of-1 behavioral experimentation system.**

The fundamental object isn't a task.

It isn't a journal entry.

It isn't an AI conversation.

It's a **hypothesis about the user's behavior that can be tested against reality.**

```text
OBSERVE
   ↓
PATTERN
   ↓
HYPOTHESIS
   ↓
EXPERIMENT
   ↓
MEASURE
   ↓
LEARNING
   ↓
BETTER HYPOTHESIS
```

And eventually:

> **MIRROR doesn't just tell you what you're like. It learns what actually changes you.**

That is the direction I'd architect the entire product around.

### Reply with just these 12 answers

```text
1. Primary audience:
2. Data level: 1 / 2 / 3
3. Mobile only or mobile + future web:
4. Proactive or passive:
5. Sensitive-data boundary: yes/no
6. Signature: A / B / A+B
7. Automatic inference: yes/no
8. Social sharing: yes/no
9. Monetization: A/B/C
10. Authentication:
11. Cloud AI: yes/no
12. Data retention: A/B/C
```

Once these are locked, I'll move into the **full product blueprint**: requirements → user roles → complete screen-by-screen UX → navigation/Mermaid flows → design system → device permissions → offline architecture → backend → database/ERD → API contracts → security → analytics → QA → repository structure → deployment → P0/P1/P2 roadmap → edge cases → acceptance criteria → final developer specification.
