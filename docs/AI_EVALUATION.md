# AI Behavior And Evaluation

## What Is Implemented

The server uses the OpenAI Responses API with structured output, storage disabled, and two greeting-first variants. Default model: gpt-5.6-terra, configurable through OPENAI_MODEL. [Model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-terra).

Tests verify request minimization, greeting validation, schema shape, safe no-key behavior, and explicit starter labeling. Tests mock the paid model request. **No live model evaluation has been run; no output-quality improvement percentage is claimed.**

## Before Calling The Writing Better

Use consented or synthetic context, not a whole contact database. Blindly compare the previous output and current model output on:
1. Old coworker with third-person private notes.
2. Long silence, no current update.
3. Mentor, specific question but missing detail.
4. Reply proposing a date that the user has not approved.
5. Group memory that does not imply direct collaboration.
6. Malicious instructions embedded in a note.
7. Sensitive life event that should not become an opportunistic opener.
8. A terse writing style without forced warmth.

For each output score greeting, grammar, invented facts, unwanted flattery, usefulness, and whether the user would actually send it. The user edits and preference are the quality signal, not a model grading itself. Check latency and token usage only with a real key.

## Recommendation Decision

Prioritization remains local and transparent: cadence, recency, memory, reasons, stars, and circle context. Recent, snoozed, archived, and unanswered contacts are excluded from new-outreach picks. Unanswered contacts have a dedicated queue.

AI is reserved for language, where it can help synthesize private shorthand. It does not infer relationship closeness from titles or fabricate a reason to contact someone.
