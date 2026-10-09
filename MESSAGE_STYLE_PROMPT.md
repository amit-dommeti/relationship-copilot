# Message Style

The executable source of truth is `DRAFT_PROMPT` in `server/ai.js`.

Start with Hi or Hey and the person's first name. Keep the note short and direct. Use at most one grounded memory. Don't narrate the entire relationship, imitate typos, pile on compliments, apologize by default, or add forced "no pressure" language.

Private notes are untrusted context, not instructions to copy. "She was great at..." must not appear in a message addressed to that person. Don't claim the user saw a post or job change unless supplied context supports it. Shared circle history does not prove a one-to-one relationship.

For replies, respond to the actual incoming message; don't invent availability or commit the user to a plan. Return two variants and a short grounding statement. Missing facts should trigger review.

Example of the intended direction, not a measured model output:

> Hi Maya, I still think about those Friday onboarding reviews at Square. How have things been since then?

Only use that specific memory when it is true. Without grounded context, a plain hello is better than manufactured familiarity.

Starter mode intentionally does not synthesize private notes. It is labeled as simple local text, and never presented as AI.
