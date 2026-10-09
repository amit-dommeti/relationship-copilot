# Case Study: The Relationship, Not The CRM

## Problem And Evidence

The owner's stated problem is avoidance: they want to stay in touch with old coworkers but find the initial message intimidating. Prior generated text pasted third-person notes into an outgoing message and sounded robotic. Import friction prevented onboarding. These are user-reported problems, not findings from a broader research study.

## Product Response

V2 focuses on a shortlist, a shared-history circle, a composer, and the reply loop. Persistent storage replaces browser-only real data. Demo data remains isolated. ZIP import removes spreadsheet preparation.

The owner is US-based and requested official LinkedIn access only. Research ruled out the personal portability route. We removed the misleading connect-first direction and documented an assisted official-export option without launching an agent or accessing the account.

## Tradeoffs

- Useful snapshot import over pretending sign-in grants network access.
- Shared chapters over current-company auto-grouping, which can misclassify relationships.
- Transparent ranking over speculative AI relationship scoring.
- Optional context-aware language generation with user review over automatic sending.
- Private hosted workspace over publishing sensitive contacts with a public portfolio.

## Evidence And Limits

Unit/integration and browser tests cover behavior, not product-market fit. Screenshots show real screens using fictional people. Model requests are mocked in automated tests; live quality is unmeasured. A real LinkedIn archive has not been imported this release.

## Next Test

Can the owner import their connections and send three messages in one week without feeling the need to rewrite every draft? Capture completion, friction, edits, and the decision to continue or change scope. Do not claim success before running that test.
