# PROJECT_OS

## One-Liner
Relationship Copilot helps ambitious professionals maintain warm career relationships by turning intimidating LinkedIn outreach into a small, thoughtful daily habit.

## Why This Exists
Many people know they should keep in touch with old coworkers, mentors, classmates, and professional contacts, but the actual act of reaching out can feel awkward, transactional, or emotionally loaded. The result is avoidant behavior: relationships fade even when the user genuinely values the person.

This product reduces the anxiety around professional outreach by helping the user decide who to contact, why now is a reasonable moment, and what to say in a way that feels human.

## Target User
Early-career to mid-career professionals who want to grow faster through stronger relationships but feel intimidated by networking, especially on LinkedIn.

Initial wedge: a PM or aspiring PM with former coworkers, classmates, recruiters, mentors, and weak ties they want to maintain without sounding fake.

## Core Job To Be Done
When I want to maintain my professional relationships but feel stuck or intimidated, help me choose one appropriate person to contact and draft a message that feels natural enough to send.

## MVP Scope

### In
- Manual contact list with name, role, company, relationship context, and LinkedIn profile URL.
- Relationship notes: how we know each other, last interaction, shared interests, and possible reasons to reconnect.
- Relationship clusters for shared contexts like old companies, school cohorts, mentor groups, or recruiter networks.
- Cluster memory so the app can remember context that applies to multiple people, such as "old Square coworkers from seller onboarding."
- Lightweight outreach queue that recommends one to three people to contact.
- Message drafting for common intents:
  - catch up
  - congratulate
  - ask for perspective
  - share something useful
  - revive a dormant relationship
- Copy-to-clipboard workflow for LinkedIn messages.
- Status tracking: drafted, copied, sent, snoozed, replied.
- Response tracking: paste replies manually, mark conversations needing response, and set a reminder to respond.
- Low-pressure emotional framing so the app feels like a coach, not a guilt tracker.

### Out For Now
- Direct LinkedIn login or password-based access.
- Automated sending of LinkedIn messages.
- Real-time personal LinkedIn inbox sync unless official messaging access is approved.
- Scraping LinkedIn profiles or inboxes.
- Bulk outreach, sequences, or sales-style automation.
- Full CRM complexity.
- Mobile app until the core behavior is validated.

## Success Metric
Primary metric: number of thoughtful outreach messages the user sends per week.

First proxy: percentage of sessions where the user copies a message draft for a real contact.

## User Promise
In under five minutes, the user can pick one relationship worth maintaining, get a message that sounds like them, and take the next step without overthinking it.

## Key Risks
- Authenticity risk: generated messages may sound generic or overly polished.
- Avoidance risk: the user may still hesitate after a draft is created.
- Trust risk: users may worry about privacy if relationship notes feel sensitive.
- Platform risk: LinkedIn does not provide broad self-serve access for personal connection messaging.
- Scope risk: this can sprawl into a full CRM before the core anxiety problem is solved.

## Edge Cases To Respect
- User has not spoken to the contact in years.
- User is worried the message sounds opportunistic.
- Contact recently changed jobs, was laid off, or is going through something sensitive.
- User wants help but does not want fake enthusiasm.
- User only has partial information about the contact.
- User wants to maintain relationships without asking for anything.

## Product Decisions Log
- Manual-first workflow: LinkedIn automation is restricted and risky; the first version should help the user draft and decide while keeping the user in control.
- Copy-to-clipboard instead of auto-send: this preserves consent, avoids account risk, and keeps the interaction human.
- Manual reply capture before inbox sync: the product should still close the relationship loop even without official personal LinkedIn messaging API access.
- One-contact queue: the core enemy is intimidation, so the product should reduce the decision surface rather than expose a giant dashboard.
- Relationship context before AI drafting: the quality of a message depends on what the user remembers about the person, not just a generic prompt.
- Clusters over generic tags: users often remember relationships by context ("Square coworkers") rather than by individual profile details, so grouping should preserve shared memory and reduce repeated setup work.
- Career-growth positioning over sales CRM: the product should feel personal, warm, and confidence-building rather than transactional.

## Demo Story
Open Relationship Copilot with a small list of former coworkers. Choose a person you have not contacted in six months. Add a short note about how you worked together, pick the intent "catch up," review a warm draft, copy it, open LinkedIn manually, and mark the outreach as sent.

## Interview Talking Points
- User insight: The blocker is not lack of intent; it is emotional friction at the exact moment of composing a message.
- Prioritization decision: The MVP avoids LinkedIn automation and focuses on the highest-leverage step: drafting a message the user feels comfortable sending.
- Trust judgment: Keeping LinkedIn manual reduces platform risk and gives users control over sensitive relationship context.
- Product taste: A one-person outreach queue lowers anxiety more effectively than a CRM-style table.
- What AI/Codex accelerated: Product framing, risk analysis, MVP definition, and the first implementation plan were shaped together from a personal pain point.

## First Build Plan
1. Create a local web app for contact entry, relationship notes, and outreach status.
2. Add message templates that work without an AI backend.
3. Add optional AI-assisted rewriting once the manual workflow feels useful.
4. Track sent, snoozed, and replied states locally.
5. Add import/export so the user owns their data.
