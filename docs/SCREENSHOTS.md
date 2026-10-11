# Screenshots

Current release assets are in `assets/screenshots/v2/`. All are actual Playwright captures with fictional data, not illustrated product mockups.

| File | Use case |
| --- | --- |
| 01-today.png | Explainable weekly shortlist |
| 02-people.png | Searchable people and relationship state |
| 03-circles.png | Shared-history groups |
| 04-composer.png | Focused greeting-first composer, starter mode |
| 05-inbox.png | Reply queue |
| 06-import.png | US official-export path |
| 07-mobile.png | Responsive mobile layout |
| 08-draft-recovery.png | Simulated save outage with copying and retry available; synthetic test contact |
| 09-draft-in-progress.png | Reopened composer keeps its pending request state and handwritten text; simulated delayed response |
| 10-import-safety.png | Malformed synthetic backup rejected before saving; previous file confirmation removed |
| 11-reply-recovery.png | Unsaved Conversation entry retained after a simulated save failure; synthetic messages only |
| 12-backup-preview.png | Complete backup summary and explicit demo-only destination before restoring; synthetic contacts and history |

Regenerate after a successful build:
```sh
UPDATE_SCREENSHOTS=1 npm run test:browser
```

Capture just the recovery asset, without replacing the existing demo gallery:
```sh
UPDATE_RECOVERY_SCREENSHOT=1 npm run test:browser
```
The recovery screenshot deliberately injects a 503 save response into a temporary local database. It is not a claim that the hosted app was experiencing an outage.

Capture the pending-generation state with fictional data and a simulated response:
```sh
UPDATE_GENERATION_SCREENSHOT=1 npm run test:browser
```
This screenshot is a UI timing demonstration, not live AI output or a model-quality claim.

Capture only the import-safety asset:
```sh
UPDATE_IMPORT_SCREENSHOT=1 npm run test:browser
```
The deliberately malformed file contains synthetic contacts only. The same browser test verifies an unchanged workspace after rejection and a successful corrected restore.

Older top-level screenshots are retained as historical assets. The README uses only the current v2 captures. No personal contact data should ever appear in a committed screenshot.

Capture only the reply-recovery asset:
```sh
UPDATE_REPLY_SCREENSHOT=1 npm run test:browser
```
The test rejects a save before it reaches the temporary database, then verifies a successful retry. It does not access LinkedIn or send a message to anyone.

Capture only the complete-backup preview:
```sh
UPDATE_BACKUP_SCREENSHOT=1 npm run test:browser
```
The synthetic backup is restored in the browser-only demo. The test checks saved conversation history and preferences, reload persistence, duplicate prevention, rejection, storage-failure retry, and an unchanged private workspace. No real export is needed.
