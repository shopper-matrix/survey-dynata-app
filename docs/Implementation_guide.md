# Dynata Survey App — Implementation Guide

Nov 9, 2026 · @Achraf

## Overview

We will build an open-source web app that hosts our own surveys and receives respondents from Dynata's panel. Dynata supplies people; our app shows the questions, screens respondents, stores answers, and sends each person back to Dynata with the right outcome.

The app has three parts:

- **Respondent survey** — a fast, mobile-first page where panelists answer questions.
- **Admin dashboard** — where our team builds surveys, sets quotas, watches progress live, and exports data.
- **API backend** — handles the Dynata redirects, screening, quotas, data storage and security.

Scope note: parameter names, end-link URLs and the hashing method come from Dynata during project setup. Everything marked "confirm with Dynata" must be checked against their integration documents before coding it as final.

## How the Dynata integration works

Dynata never sees our survey; it only sends respondents in and receives them back. Our server is the single source of truth for each person's outcome, and Dynata pays and counts based on the end link it receives.

&#91;embedded content: Dynata redirect loop · entry, survey, four outcomes, signed return\]

Each respondent makes one round trip: Dynata entry URL → our survey → exactly one signed end link back to Dynata.

| Outcome | When it happens | What Dynata does |
| --- | --- | --- |
| Complete | Qualified, finished, passed quality checks | Rewards panelist; billable complete |
| Screen-out | Failed a screener question | Small reward; usually not billed as a complete |
| Over-quota | Qualified, but their quota cell (or the survey) is full | Small reward; tells Dynata to stop sending that profile |
| Quality term | Failed attention, speed or bot checks | No reward; may flag the panelist |

Example URLs (placeholders only — real formats come from Dynata):

```
Entry (Dynata → us):
https://survey.ourcompany.com/s/SURVEY123?rid=ABC987&sig=...

Complete (us → Dynata):
https://<dynata-end-link>/complete?rid=ABC987&hash=<signature>
```

Signing: Dynata typically asks for a hash of the URL computed with a shared secret key, appended as a parameter, so respondents cannot fake a complete by editing the link. The exact algorithm and which part of the URL is hashed must be confirmed with Dynata.

## Tech stack and repository structure

Recommended stack: TypeScript end to end, so frontend and backend share types and validation. Every choice below is mainstream, free and open source, which makes the project easy to hire for and to contribute to.

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React + Vite + TypeScript | Fast builds, huge ecosystem |
| UI / styling | Tailwind CSS + shadcn/ui (Radix) | Clean modern look, accessible components |
| Forms and validation | React Hook Form + Zod | Same Zod schemas reused in the backend |
| Backend | Node.js 20 LTS + Fastify + TypeScript | Fast, simple, good plugin system |
| Database | PostgreSQL 16 | Reliable, JSON support for flexible answers |
| ORM / migrations | Prisma | Typed queries, versioned migrations |
| Admin auth | Email + password with Argon2 hashing, or SSO via OAuth (Google / Microsoft) | Protects the dashboard |
| Bot protection | Cloudflare Turnstile | Free, privacy-friendly CAPTCHA |
| Tests | Vitest (unit), Playwright (end-to-end) | Covers all redirect paths |
| Packaging | Docker + Docker Compose | Same setup on laptop and server |
| CI/CD | GitHub Actions | Lint, test, build, deploy on every push |
| Monitoring | Sentry (errors) + uptime monitor | Know about failures before Dynata does |

Alternative if the team prefers one codebase: Next.js can host both frontend and API. The steps in this guide still apply; only the folder layout changes.

Repository layout (a monorepo using pnpm workspaces):

```
dynata-survey-app/
├── apps/
│   ├── web/            # React frontend (respondent survey + admin dashboard)
│   └── api/            # Fastify backend
│       ├── src/
│       │   ├── routes/       # entry, survey, admin, export
│       │   ├── dynata/       # redirect + hashing logic (isolated module)
│       │   ├── quality/      # speeder, straightlining, duplicate checks
│       │   └── quotas/
│       └── prisma/schema.prisma
├── packages/
│   └── shared/         # Zod schemas and types used by both apps
├── docker-compose.yml
├── .env.example        # every variable documented, no real secrets
├── .github/workflows/  # CI pipelines
├── docs/               # setup, architecture, Dynata integration notes
├── LICENSE
└── README.md
```

Keep all Dynata-specific code inside `apps/api/src/dynata/`. That way the app can later support other sample providers (Cint, PureSpectrum, Lucid) by adding a sibling module, which also makes the open-source project more useful to others.

## Step-by-step build plan

Build in six phases; each ends with something testable. The Dynata redirect loop (phase 3) is the most important piece and should be working end to end before the dashboard is polished.

### Phase 1 — Project setup

1. Create the GitHub repository (public or private until launch) with the folder layout above.
2. Set up pnpm workspaces, TypeScript, ESLint and Prettier shared across apps.
3. Write `docker-compose.yml` with three services: `web`, `api`, `db` (PostgreSQL), so `docker compose up` runs everything locally.
4. Create `.env.example` listing every variable: `DATABASE_URL`, `APP_BASE_URL`, `DYNATA_SECRET_KEY`, `DYNATA_END_COMPLETE`, `DYNATA_END_SCREENOUT`, `DYNATA_END_OVERQUOTA`, `DYNATA_END_QUALITY`, `SESSION_SECRET`, `TURNSTILE_SECRET`, `SENTRY_DSN`.
5. Add a GitHub Actions workflow that runs lint, type-check and tests on every pull request.

### Phase 2 — Data model (Prisma schema)

1. **Survey** — id, title, status (draft / test / live / closed), target completes, Dynata project ID, per-survey end links and secret (so several Dynata projects can run at once), created/updated dates.
2. **Question** — survey id, order, type (single choice, multi choice, grid, open text, number, rating), text, options (JSON), `isScreener` flag, `isAttentionCheck` flag, display logic (JSON).
3. **ScreeningRule** — question id, condition (e.g. "age < 18"), action (terminate as screen-out).
4. **QuotaCell** — survey id, name (e.g. "Women 25–34"), conditions (JSON), target, current count.
5. **Respondent** — survey id, Dynata respondent ID, status (started / complete / screenout / overquota / quality / abandoned), start and end time, device type, hashed IP, quality flags.
6. **Answer** — respondent id, question id, value (JSON), answered-at time.
7. **RedirectLog** — respondent id, outcome, final URL sent, time. Essential for reconciling counts with Dynata's invoice.
8. **AdminUser** — email, password hash, role (owner / editor / viewer).

Add a unique index on (survey id, Dynata respondent ID) so the same person can never be counted twice.

### Phase 3 — Backend: the Dynata integration

1. **Entry endpoint** `GET /s/:surveyId` — Dynata sends respondents here with their ID in the query string (parameter name: confirm with Dynata).
   - Check the survey is live (or in test mode for test IDs).
   - Verify the incoming URL signature if Dynata signs it.
   - If this respondent ID already exists: send a returning "in progress" respondent back to their place; send an already-finished one to the quality end link.
   - Otherwise create the Respondent row, set an HTTP-only secure session cookie, and redirect to the survey page on the frontend.
2. **Survey API** — `GET /api/session/questions` returns the next question(s); `POST /api/session/answers` validates (Zod) and saves answers. The server, never the browser, decides what comes next.
3. **Screening and quotas** — after each screener answer, run the rules. Failed rule → outcome `screenout`. Qualified but the matching quota cell is full → outcome `overquota`. Increment quota counts only on **complete**, inside a database transaction to avoid overshooting when many people finish at once.
4. **Finish** — when the respondent ends (any outcome), the server: runs quality checks, sets the final status, writes the RedirectLog, builds the Dynata end URL with the respondent ID, signs it, and returns it. The frontend then does `window.location.replace(url)`.
5. **Signing module** `dynata/sign.ts` — one function `buildEndUrl(survey, outcome, respondentId)`. Implement the hashing scheme Dynata specifies (typically an HMAC or hash of the URL with a shared secret, appended as a parameter). Keep it isolated and fully unit-tested.
6. **Make finishing idempotent** — if a respondent refreshes the last page, return the same end URL, never a new outcome.

### Phase 4 — Backend: admin features

1. Admin login with rate limiting and secure sessions.
2. CRUD endpoints for surveys, questions, screening rules and quotas.
3. Live stats endpoint: starts, completes, screen-outs, over-quotas, quality terms, incidence rate, median length of interview, completes per quota cell.
4. Test-link generator: creates fake respondent IDs that run through the full flow and land on a local "test end" page instead of Dynata.
5. Export endpoint: CSV and SPSS (`.sav`) with one row per respondent, including Dynata ID and status.

### Phase 5 — Frontend: respondent survey

1. Welcome / consent screen with a short privacy notice.
2. One question (or one small group) per screen, large tap targets, a progress bar.
3. Components for each question type; grids collapse into stacked cards on phones.
4. No back button through screeners; a soft back button elsewhere if the survey allows it.
5. Clear validation messages; answers saved after every screen so a lost connection loses nothing.
6. A neutral "Thank you, redirecting…" screen shown for under a second before the Dynata redirect.
7. Support multiple languages from the start (i18n files), since Dynata panels are international.

### Phase 6 — Frontend: admin dashboard

1. Survey list with status badges.
2. Survey builder: add, reorder (drag and drop) and edit questions; mark screeners and attention checks; live preview on a phone-sized frame.
3. Quota editor and Dynata settings page (respondent ID parameter, end links, secret, entry URL to give to Dynata — copy button).
4. Live fieldwork dashboard: counters, a completes-over-time chart, quota progress bars, and a table of recent respondents with their status and quality flags.
5. Export and test-link buttons; a "Pause survey" switch that instantly over-quotas new entrants.

## Design guidelines

Design for a stranger on a phone with patchy signal: most panel respondents answer on mobile, and every confusing screen costs completes and money.

- **Mobile-first.** Design at 375 px wide first, then scale up. Tap targets at least 44 × 44 px; answer options are full-width cards, not tiny radio buttons.
- **Calm and neutral.** Plain white or soft grey background, one accent colour, one readable font (e.g. Inter or the system font stack) at 16–18 px for question text. Avoid heavy branding that could bias answers.
- **One thing per screen.** One question, one clear "Next" button fixed at the bottom on phones, a thin progress bar at the top.
- **Accessible.** Meet WCAG 2.2 AA: 4.5:1 text contrast, full keyboard navigation, labels for screen readers, visible focus states. shadcn/ui components handle much of this.
- **Light and dark mode.** Define colours as design tokens (CSS variables) and follow the device setting.
- **Fast.** Target under 1.5 s first load on 4G; keep the respondent bundle small and lazy-load the admin dashboard separately.
- **Honest feedback.** Friendly error messages ("Please choose one option"), and a polite, non-judgemental screen-out message ("Thanks, this survey is looking for a different profile").
- **Admin dashboard** can be denser: a sidebar layout, data tables, charts (Recharts) and status badges in consistent colours (green complete, amber in progress, grey screen-out, red quality term).

Deliverable before coding the UI: a small Figma file (or a clickable prototype) with the respondent flow on phone and desktop, plus the main admin screens, approved by the project owner.

## Data quality, security and privacy

Quality checks protect the data; security and privacy protect respondents and our contract with Dynata. Both must be in place before the first live respondent.

### Quality checks (run at finish, flag or terminate as "quality")

- **Speeders** — completion time under a threshold, e.g. less than one third of the median length of interview.
- **Attention checks** — e.g. "Select 'Strongly disagree' for this row"; failing one or two terminates.
- **Straightlining** — identical answers across a whole grid.
- **Duplicates** — same Dynata ID (blocked by the unique index), plus optional device fingerprint and hashed IP checks.
- **Bots** — Cloudflare Turnstile on the first screen and a hidden honeypot field.
- **Open-ended answers** — flag gibberish or copy-pasted text for manual review in the dashboard.

Agree with Dynata in advance which checks count as quality terminations and how post-field removals are reported back for replacement.

### Security

- HTTPS everywhere, HSTS enabled, secure HTTP-only cookies with SameSite.
- All secrets (Dynata key, database password) in environment variables or the hosting platform's secret store — **never committed to GitHub**. Enable GitHub secret scanning to catch mistakes.
- Validate every input with Zod; use Prisma (parameterised queries) only, no raw SQL from user input.
- Rate-limit the entry endpoint and admin login; add security headers (helmet) and a strict Content-Security-Policy.
- Admin roles with least privilege; log admin actions.
- Dependabot or Renovate for dependency updates; `npm audit` in CI.

### Privacy (GDPR and similar laws)

- Collect no names, emails or phone numbers unless explicitly agreed with Dynata; the Dynata ID is the only identifier.
- Store IP addresses only as salted hashes, used for fraud checks.
- Show a short privacy notice on the welcome screen with the data controller's name and contact.
- Host the database in the region required by our clients (e.g. EU hosting for EU respondents).
- Set a data retention period (e.g. delete raw respondent data 12–24 months after fieldwork) and automate it.
- Encrypted, automated daily database backups, with a tested restore.

## Testing and Dynata certification

Every outcome path must be proven by automated tests and then by Dynata's own test links before launch.

1. **Unit tests (Vitest)** — URL signing, screening rules, quota logic (including two respondents finishing at the same instant), quality checks, idempotent finish.
2. **End-to-end tests (Playwright)** — one scripted respondent per outcome: complete, screen-out, over-quota, quality term, duplicate entry, invalid signature. Each test asserts the exact redirect URL. Run on a phone viewport and a desktop viewport.
3. **Load test** (k6 or Artillery) — simulate a burst of a few hundred simultaneous entrants, since Dynata can send traffic quickly at launch. Check response times and that quotas never overshoot.
4. **Staging environment** — a full copy of production on its own URL and database, where every change is tested first.
5. **Dynata test links** — send Dynata the staging or production entry URL; they run test respondents through each end link and confirm they are recorded correctly. Fix anything they report.
6. **Soft launch** — Dynata releases a small batch (often around 10% of the target). Review data, timings, incidence rate and quality flags before approving full launch.
7. **Daily reconciliation during fieldwork** — compare our completes in RedirectLog with Dynata's counts; investigate any gap immediately.

## Publishing open source on GitHub

The code can be public, but our Dynata credentials, survey content and respondent data must never be. Keep code and configuration strictly separate.

1. **Choose a licence.** MIT (simplest, most permissive) or Apache-2.0 (adds patent protection). Check with management or legal that the company allows open-sourcing.
2. **Check Dynata's terms.** Make sure publishing the integration approach is allowed; never publish their private documentation, real end-link URLs or keys. Use placeholders in `.env.example`.
3. **Repository files:** `README.md` (what it does, screenshots, quick start with `docker compose up`), `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` (how to report vulnerabilities privately), `CHANGELOG.md`, and issue / pull request templates.
4. **Protect the main branch:** require pull requests, one review and passing CI before merge.
5. **Turn on** secret scanning, push protection, Dependabot alerts and CodeQL code scanning (all free for public repos).
6. **Seed data:** include a demo survey and fake respondents so anyone can try the app without a Dynata account.
7. **Releases:** tag versions (v1.0.0, semantic versioning) and publish Docker images to GitHub Container Registry from CI.
8. **Before making the repo public:** scan the full git history for secrets (e.g. with gitleaks). If a secret was ever committed, rotate it — deleting the file is not enough.

## Deployment: putting it online

Start with a managed platform (Option A): it is the fastest path to a secure, reliable launch and needs no server administration. Move to a VPS or cloud provider later only if cost or control requires it.

|  | Option A: Managed platform | Option B: Own server (VPS) | Option C: Big cloud |
| --- | --- | --- | --- |
| Examples | Render, Railway, Fly.io | Hetzner, OVHcloud, DigitalOcean | AWS, Azure, Google Cloud |
| Effort | Low | Medium | High |
| Who maintains servers | The platform | Our team | Our team (with managed services) |
| Best for | First launch, small team | Lower cost, full control | Enterprise clients, strict compliance |

Prices change often, so compare current plans before choosing; EU-hosted options (Hetzner, OVHcloud, or EU regions of the others) help with GDPR.

### Option A steps (managed platform)

1. Connect the GitHub repository to the platform.
2. Create a managed PostgreSQL database with daily backups, in the right region.
3. Create two services from the repo: `api` (Docker or Node build) and `web` (static site build of the React app).
4. Add all environment variables from `.env.example` in the platform's secret settings.
5. Run Prisma migrations automatically on each deploy (`prisma migrate deploy`).
6. Buy a domain (e.g. `survey.ourcompany.com`), point DNS at the platform, and let it issue the HTTPS certificate automatically.
7. Create a second, identical **staging** environment from the `develop` branch; production deploys only from `main`.

### Option B steps (own server)

1. Rent a Linux VPS (Ubuntu LTS), create a non-root user, enable the firewall (ports 22, 80, 443 only), use SSH keys and disable password login.
2. Install Docker and Docker Compose.
3. Use a production `docker-compose.prod.yml` with `web`, `api`, `db` and **Caddy** as a reverse proxy — Caddy gets and renews HTTPS certificates automatically.
4. Deploy with a GitHub Actions workflow: build images, push to GitHub Container Registry, SSH into the server, `docker compose pull && docker compose up -d`.
5. Schedule encrypted database backups to separate storage (e.g. S3-compatible object storage) and test a restore.
6. Enable automatic security updates on the server.

### For every option

- Error tracking with Sentry, uptime monitoring on the entry URL with alerts to email or Slack.
- Centralised logs, kept for a limited period and without personal data.
- A health-check endpoint (`/health`) that the platform and monitors call.
- A short runbook in `docs/`: how to deploy, roll back, restore a backup, and pause a live survey.

## Go-live checklist and questions for Dynata

A rough estimate for a small team of two or three developers is 8–12 weeks from kick-off to the first live project; the team should refine this after Phase 1.

### Questions to send Dynata before development starts

1. What is the exact name of the respondent ID parameter in the entry URL, and do you send any other parameters (country, language, project ID)?
2. What are the end-link URLs for complete, screen-out, over-quota and quality termination, and how should the respondent ID be appended?
3. Do you require signed / hashed URLs? Which algorithm, which part of the URL is hashed, and how is the secret key delivered and rotated?
4. Do you sign the incoming entry URL, so we can verify it?
5. How do you run test links, and what do you need from us to certify the integration?
6. How do we report post-field quality removals and get replacements?
7. Is there an API to create projects, set quotas and get live counts, and how do we get access?
8. Any restrictions on data we may collect, on hosting location, or on open-sourcing the integration code?

### Go-live checklist

- [ ] Dynata integration details received and coded into the `dynata/` module
- [ ] All outcome paths pass automated tests (unit + Playwright)
- [ ] Load test passed with no quota overshoot
- [ ] Production and staging online with HTTPS and monitoring
- [ ] Secrets stored only in the hosting platform; git history scanned
- [ ] Backups running and a restore tested
- [ ] Privacy notice live and retention job scheduled
- [ ] Dynata test links certified
- [ ] Soft launch reviewed and approved
- [ ] Daily reconciliation process agreed with Dynata

User stories for the build: Backlog
