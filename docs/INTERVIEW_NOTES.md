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

## Reliability Iteration: Your Edits Win

"A generated suggestion should not have more authority than the person writing. I reproduced a delayed response overwriting a newer saved message, then gave each request a contact and workspace lifetime. New edits invalidate the suggestion, and navigation cannot create duplicate work or carry old results into a new workspace. I chose to discard stale suggestions rather than attempt a surprising automatic merge. The evidence is controlled timing tests, not better model writing or measured user impact."

## Reliability Iteration: An Error Must Mean No Partial Import

"A file preview is not enough to make an import safe. I reproduced a backup reporting failure after it had already changed a contact. I moved validation ahead of all writes, made the restore one all-or-nothing transaction, and tested a failure after the final planned write. I also checked the file-picker experience: rejecting a new file must remove the old file's confirmation. The decision prioritized trust and recoverability over adding another feature."

Evidence: a failing-before/fixed-after regression, rollback and identity tests, a synthetic 10,000-contact local test, and browser rejection/retry checks. No production data-loss rate or user trust uplift was measured.

## Reliability Iteration: Protect The Work Between Saves

"I tested a natural sequence: paste a reply, then set a reminder before saving it. The reminder worked, but its screen update erased the reply. I separated the unsaved entry from the displayed form and kept it attached to the right person. Then I tested slow saves, new typing, duplicate clicks, and switching between people. I chose tab-only recovery to avoid adding another persistent copy of private conversations, and documented the crash-recovery and ambiguous-retry limits."

Evidence: a failing-before/fixed-after browser test, six focused buffer tests, and synthetic failure/timing checks. No reduction in real-world message loss has been measured.

## Reliability Iteration: A Failed Confirmation Is Not A Failed Save

"Disabling double-clicks did not cover the harder case: the server saved a reply, but the confirmation was lost. I reproduced duplicate history on retry, then gave each recording a reusable identity. I tested not just duplicates, but whether an old retry could reset a newer reminder or reply decision. I also kept intentional repeated messages possible and documented that the protection depends on retaining the same identity in the current tab."

Evidence: a failing-before/fixed-after API regression, transaction/concurrency tests, and browser fault injection after actual local writes. No live LinkedIn delivery or measured production incident reduction is claimed.

## Reliability Iteration: A Completed Action Is Not Permission To Erase New Work

"I tested what happens after clicking 'I sent it' and immediately starting another thought. A slow completion erased the newer saved draft. I made the action remember the exact person and edit that were clicked, then tested both delayed recording and delayed cleanup. The completion now leaves newer writing and other conversations alone. I kept the scope to same-tab behavior and documented the remaining shutdown and cross-device limits."

Evidence: a failing-before/fixed-after browser regression, an edit-revision unit test, and controlled local timing/failure checks. This is a verified application behavior, not measured retention or AI writing-quality improvement.

## Reliability Iteration: The Demo Must Keep The Same Promise

"I tested restoring a full backup in the demo and found that its success message hid missing conversation history and preferences. I reused the real workspace's import rules so the demo could be a trustworthy rehearsal, then tested rejection and browser-storage failure. I made the destination explicit and kept the real workspace untouched. The tradeoff is that demo data is still browser-local, not a second cloud backup."

Evidence: a failing-before/fixed-after browser restore, direct parity tests against local server storage, and simulated quota-failure/retry checks. No increase in adoption or successful real-user imports was measured.

## Move Safety To The Durable Write

"The first fix preserved newer writing by saving it again after recording a sent message. That still depended on the browser staying alive. I reproduced the remaining loss directly in storage, then made clearing the draft conditional on its saved version and exact text, in the same transaction as the message. Separate conversation-history entries now leave drafts alone. I chose an opaque version instead of text comparison alone because changing text and changing it back is still a newer edit."

Evidence: local storage reproducer, version/identity/rollback tests, and retry-guard tests. This is a narrower durability guarantee, not general collaborative editing or a measured improvement in user trust.

## Don't Overclaim

No fabricated PM experiments, launch cohorts, conversion lift, model-quality wins, or production LinkedIn sync. Historical v0 labels represent feature milestones, not seven validated releases.
