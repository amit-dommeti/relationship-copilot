# Relationship Copilot

[![Test](https://github.com/amit-dommeti/relationship-copilot/actions/workflows/test.yml/badge.svg)](https://github.com/amit-dommeti/relationship-copilot/actions/workflows/test.yml)

Relationship Copilot is a dark-mode productivity app for people who want to maintain career relationships but freeze when it is time to message old coworkers, mentors, recruiters, or professional contacts.

The product helps you import LinkedIn contacts, cluster people by where you knew them from, choose the right person to contact this week, draft a message that sounds human, and remember to respond when the conversation continues.

![Relationship Copilot dashboard](assets/screenshots/01-dashboard.png)

## Why This Exists

Networking advice usually says "just reach out." The hard part is not knowing that relationships matter. The hard part is deciding who to message, remembering the shared context, writing something that does not sound fake, and following up when someone replies.

Relationship Copilot turns that anxious blank-message moment into a small workflow:

1. Import contacts.
2. Group them by real-life context.
3. Pick a warm relationship.
4. Draft a short human message.
5. Track replies and reminders.

## Product Highlights

- **LinkedIn CSV import**: Import `Connections.csv` from LinkedIn's official data export.
- **Weekly recommendations**: Rank contacts by warmth, recency, relationship type, status, and message readiness.
- **Relationship clusters**: Group people by where you knew them from, such as Square, NYU, PM mentors, or recruiters.
- **Cluster memory**: Store shared context once and reuse it across similar outreach.
- **Human message composer**: Converts private shorthand into conversational second-person messages.
- **Reply tracking**: Paste replies, mark conversations as needing response, and set browser reminders.
- **Local-first privacy**: Data stays in browser storage for v0.
- **Platform-safe LinkedIn stance**: No password access, scraping, inbox automation, or auto-send behavior.

## Screenshots

| Weekly focus | Relationship clusters |
| --- | --- |
| ![Weekly focus](assets/screenshots/01-dashboard.png) | ![Clusters](assets/screenshots/02-clusters.png) |

| Human message drafting | Reply reminders |
| --- | --- |
| ![Drafting](assets/screenshots/03-drafting.png) | ![Reply reminders](assets/screenshots/04-replies.png) |

## Demo Flow

1. Run the app locally.
2. Click **Demo mode** to load a Square coworker cohort plus mentor and recruiter examples.
3. Review **This week's recommended contacts**.
4. Click the **Square** cluster and see old coworkers grouped together.
5. Select Maya Patel and click **Draft message**.
6. Copy the message, mark it sent, paste a simulated reply, and set a reminder.

## Local Development

```bash
git clone https://github.com/amit-dommeti/relationship-copilot.git
cd relationship-copilot
npm install
npm start
```

Open [http://localhost:4173](http://localhost:4173).

Run the message composer smoke test:

```bash
npm test
```

## AI Recommendation Strategy

The app uses a transparent local ranking engine first. It scores contacts by:

- whether they have not been contacted yet
- relationship warmth, such as former coworker or mentor
- available memory or reason to reach out
- cluster memory availability
- time since connection
- whether a reply is waiting
- whether the contact was already handled

If served with `web/server.mjs` and a usable `OPENAI_API_KEY`, the **Refresh AI picks** action can call an OpenAI-backed endpoint. The endpoint sends sanitized contact summaries and asks the model to return up to four weekly recommendations with a reason and next step. If the API key is missing, the local ranking remains active so demos do not break.

## Message Style

The message composer is intentionally anti-template. It starts with a greeting, keeps the message short, rewrites third-person notes into second-person language, and avoids fake networking phrases.

See [MESSAGE_STYLE_PROMPT.md](MESSAGE_STYLE_PROMPT.md).

Example output:

```text
Hi Maya — hope you’ve been doing well. I was thinking back to our work on onboarding experiments. You had a real knack for turning messy user feedback into clear product bets. I saw that you moved into a fintech PM role. No pressure, but I’d enjoy catching up sometime.
```

## LinkedIn Integration Position

Relationship Copilot does not ask for LinkedIn passwords and does not automate sending messages.

Personal LinkedIn inbox and connection sync are not available through a normal self-serve public API. LinkedIn supports APIs for some approved use cases, including Pages messaging for LinkedIn Pages, but that is different from reading a member's personal inbox. The current product uses official LinkedIn data export plus manual copy/paste to avoid account risk.

## Product Docs

- [Product OS](PROJECT_OS.md)
- [Case Study](docs/CASE_STUDY.md)
- [Iteration Log](docs/ITERATION_LOG.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Demo Script](docs/DEMO_SCRIPT.md)
- [Screenshot Shot List](docs/SCREENSHOTS.md)
- [Roadmap](docs/ROADMAP.md)

## Tech Stack

- Vanilla HTML, CSS, and JavaScript
- Node.js local server
- Browser localStorage for v0 persistence
- Optional OpenAI-compatible recommendation endpoint through `web/server.mjs`

## Repository Structure

```text
.
├── assets/
│   ├── demo-data/
│   └── screenshots/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CASE_STUDY.md
│   ├── DEMO_SCRIPT.md
│   ├── ITERATION_LOG.md
│   ├── ROADMAP.md
│   └── SCREENSHOTS.md
├── web/
│   ├── app.js
│   ├── index.html
│   ├── message-engine.test.mjs
│   ├── server.mjs
│   └── styles.css
├── MESSAGE_STYLE_PROMPT.md
├── PROJECT_OS.md
└── package.json
```

## Repository Status

This is a portfolio-ready v0. It is intentionally local-first and platform-safe. The next production step would be adding accounts, encrypted storage, durable reminders, and approved integrations.
