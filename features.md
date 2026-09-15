For Aks, I would **not** make Notifications a generic “push notification settings” screen. It should control the few notifications that actually support the core loop: **Notice → Experiment → Learn → Return**.

### Notifications screen

```text
Notifications

Stay in the loop
Choose what Aks should bring to your attention.

WHAT AKS CAN NOTIFY YOU ABOUT

Insights
When Aks notices a meaningful pattern.
                         [ toggle ]

Experiments
Reminders and updates when an experiment is active.
                         [ toggle ]

Reflections
A gentle nudge when it's useful to check in.
                         [ toggle ]

Weekly reflection
A weekly look at what changed and what you learned.
                         [ toggle ]


TIMING

Quiet hours
Don't send notifications during these hours.
                         >


NOTIFICATION PREVIEW

“I noticed something about yesterday.”
“Your experiment has 2 days left.”
“You may have learned something this week.”


Manage notifications
Open your device notification settings.
```

### What each notification should actually do

**Insights**
This is probably the most important one. Example:

> “I noticed something about yesterday.”

It should only fire when Aks has something genuinely interesting, not every day.

**Experiments**
Examples:

> “Day 4 of your focus experiment.”
> “Your experiment ends tomorrow.”

This directly supports the experiment loop.

**Reflections**
Keep this gentle. Not:

> “You haven't checked in today 😔”

Instead:

> “A quick check-in might help Aks understand this pattern.”

No guilt, no streak pressure.

**Weekly reflection**
This is a strong retention mechanism:

> “Here’s what Aks learned about you this week.”

That gives the user an actual reason to return.

### I would add one more thing: Notification preferences, not notification history

I **wouldn't show a list of past notifications** here. That's clutter and doesn't help the user.

The screen should answer:

> **“What is Aks allowed to interrupt me about?”**

That's it.

### Important Aks principle

Don't build:

```text
Daily reminder
Morning reminder
Evening reminder
Streak reminder
Missed check-in
Come back
You haven't used Aks
```

That turns Aks into a habit-tracking app.

Instead, notifications should feel like **Aks discovered something worth telling you**.

The best notification philosophy is:

> **Don't remind me to use Aks. Tell me when Aks has something useful to say.**

For the hackathon, I'd make **Insights + Experiments + Weekly Reflection** the headline notification categories and keep everything else minimal.
