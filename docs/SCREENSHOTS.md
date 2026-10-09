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

Regenerate after a successful build:
```sh
UPDATE_SCREENSHOTS=1 npm run test:browser
```

Older top-level screenshots are retained as historical assets. The README uses only the current v2 captures. No personal contact data should ever appear in a committed screenshot.
