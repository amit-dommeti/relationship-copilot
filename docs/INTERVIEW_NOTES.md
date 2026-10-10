# Interview Notes

## A Defensible Build Story

"I started from my own avoidance of reaching out to old coworkers. The first prototype had two practical failures: importing LinkedIn data was too much work, and its drafts sounded assembled from notes. I redesigned the workflow around a small shortlist, shared-history circles, and a reply queue, then added direct archive import and durable storage."

## Judgment To Highlight

- **User empathy:** reduced the blank-page moment without turning outreach into a sales quota.
- **Platform constraints:** verified the US access limitation and declined to label profile login as network integration.
- **Trust:** demo isolation, per-owner storage, narrow AI context, manual sending.
- **Execution:** real browser captures and automated tests across screen sizes; portable hosting path.
- **Learning honesty:** the build is tested; user retention, writing preference, and live integration are not validated.

## Reliability Iteration: Draft Recovery

"I tested the moment a save fails, not just the successful writing flow. A rejected save blocked Copy message and could label an unsaved draft as saved when reopened. I separated reading and copying from persistence, retained the newest edit until acknowledged, and added explicit retry. I proved the original failure with a browser regression, then verified recovery and slow-response ordering. The tradeoff is deliberate: no new private browser cache, so unsaved text still requires an open tab."

Evidence: five focused save-queue tests plus browser outage/retry/reload checks. This demonstrates engineering judgment, not a measured reduction in user abandonment.

## Don't Overclaim

No fabricated PM experiments, launch cohorts, conversion lift, model-quality wins, or production LinkedIn sync. Historical v0 labels represent feature milestones, not seven validated releases.
