# LinkedIn Access For A US Account

Researched October 9, 2026. The product owner's account is US-based and they requested official access only.

## Recommended Route

Use LinkedIn's native **Download your data** flow with Connections selected. Import the resulting ZIP directly into Connections in this app; no unzipping or spreadsheet editing is needed. Only Connections.csv is inspected. Other archive categories, including messages, are ignored.

LinkedIn says selected categories may be emailed within minutes, while a larger archive may take 24 hours. Download links are available for 72 hours. Timing is controlled by LinkedIn, not this app. [Official export instructions](https://www.linkedin.com/help/linkedin/answer/a1339364/downloading-your-account-data).

Repeat imports preserve notes, circles, drafts, and existing relationship state. The current company in a LinkedIn export does **not** prove you worked together there, so the app does not automatically classify current Square employees as former teammates.

## Why Not OAuth?

OAuth is a permission-granting sign-in flow. It can only grant permissions that the platform makes available; adding a login button does not create data access.

[Sign in with LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2) gives your own profile details. [Member Data Portability](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/member-data-portability-member/) is restricted to EEA and Switzerland members. The [third-party program](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/member-data-portability-3rd-party/) has separate eligibility and approval requirements. None provides a general US personal inbox integration for this app.

No unofficial vendor, scraping adapter, browser-cookie collection, or geographic workaround is included.

## Could A Dot Handle The Export?

**Plausible assisted workflow, not yet verified on this account.** A dot has a separate cloud browser and can use an optionally connected computer. Website sign-in is private, but sessions are not inherited and some websites block cloud browsers. [Official dot documentation](https://learn.chatgpt.com/docs/dots/computers-and-apps).

A narrow task could request the official Connections archive, notify you when a step needs input, inspect the resulting file, and prepare an import. You must authorize the task and destination separately. No such task or account access has been started.

The built-in browser currently cannot automate uploads. A supported local file handoff may reduce the remaining work, but needs testing rather than a promise. [Browser documentation](https://learn.chatgpt.com/docs/browser).

The app includes a copyable assistant brief that constrains the task to the official archive, user-handled login/verification, a preview before saving, and no ongoing monitoring. A dot helps with the handoff; it does not turn a snapshot into live LinkedIn access.

## Responses

This release uses manual reply capture and calendar reminders. A future opt-in email-notification integration could surface some LinkedIn activity, but notifications may be incomplete and are not equivalent to the actual inbox. Do not label that future approach real-time inbox sync without proving completeness and timing.
