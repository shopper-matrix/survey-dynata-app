# Backlog — user stories

Nov 9, 2026

43 stories in 8 epics, about 157 story points — roughly six two-week sprints for two or three developers. Points use the Fibonacci scale (1, 2, 3, 5, 8); "Must" stories are needed for the first live project, "Should" stories can follow.

**Start with DSA-106:** send Dynata the questions from the guide on day one, because the signing and redirect stories depend on their answers.

| ID | Story | Epic | Priority | Points | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- |
| DSA-101 | Monorepo and shared tooling | Setup | Must | 3 | — | In progress |
| DSA-102 | Docker Compose local environment | Setup | Must | 3 | 101 | To do |
| DSA-103 | CI pipeline | Setup | Must | 2 | 101 | To do |
| DSA-104 | Environment config and .env.example | Setup | Must | 1 | 101 | To do |
| DSA-105 | Quick UI prototype in code | Setup | Must | 2 | — | To do |
| DSA-106 | Collect Dynata integration specs | Setup | Must | 1 | — | To do |
| DSA-201 | Prisma schema and first migration | Data model | Must | 5 | 102 | To do |
| DSA-202 | Demo seed data | Data model | Should | 2 | 201 | To do |
| DSA-301 | Per-survey Dynata settings | Dynata | Must | 2 | 201, 106 | To do |
| DSA-302 | Entry endpoint | Dynata | Must | 5 | 301 | To do |
| DSA-303 | Incoming signature verification | Dynata | Must | 3 | 302, 106 | To do |
| DSA-304 | Signed end-link builder | Dynata | Must | 3 | 301, 106 | To do |
| DSA-305 | Finish endpoint and RedirectLog | Dynata | Must | 5 | 304 | To do |
| DSA-306 | Question delivery and answer API | Dynata | Must | 5 | 302 | To do |
| DSA-307 | Screening engine | Dynata | Must | 5 | 306 | To do |
| DSA-308 | Quota engine | Dynata | Must | 5 | 307 | To do |
| DSA-309 | Pause survey switch | Dynata | Should | 2 | 308 | To do |
| DSA-401 | Design system and base components | Frontend | Must | 3 | 105 | To do |
| DSA-402 | Welcome and consent screen | Frontend | Must | 3 | 401 | To do |
| DSA-403 | Question type components | Frontend | Must | 8 | 401, 306 | To do |
| DSA-404 | Survey flow, autosave and resume | Frontend | Must | 5 | 403 | To do |
| DSA-405 | Redirect and end screens | Frontend | Must | 2 | 305, 404 | To do |
| DSA-406 | Multi-language support | Frontend | Should | 3 | 403 | To do |
| DSA-501 | Quality checks module | Quality | Must | 5 | 305 | To do |
| DSA-502 | Duplicate and bot protection | Quality | Must | 3 | 302, 402 | To do |
| DSA-503 | Security hardening | Quality | Must | 3 | 302 | To do |
| DSA-504 | Privacy notice and data retention | Quality | Should | 3 | 201 | To do |
| DSA-601 | Admin authentication and roles | Admin | Must | 5 | 201 | To do |
| DSA-602 | Survey and question CRUD API | Admin | Must | 5 | 601 | To do |
| DSA-603 | Survey builder UI | Admin | Must | 8 | 602, 401 | To do |
| DSA-604 | Quota editor and Dynata settings UI | Admin | Must | 3 | 603, 301 | To do |
| DSA-605 | Live fieldwork dashboard | Admin | Must | 5 | 305, 601 | To do |
| DSA-606 | Test-link generator | Admin | Must | 2 | 305 | To do |
| DSA-607 | Data export (CSV, SPSS) | Admin | Must | 5 | 305 | To do |
| DSA-701 | Unit tests for core logic | Testing | Must | 3 | 304, 308, 501 | To do |
| DSA-702 | End-to-end tests for every outcome | Testing | Must | 5 | 405, 606 | To do |
| DSA-703 | Load test | Testing | Must | 3 | 801 | To do |
| DSA-704 | Dynata certification and soft launch | Testing | Must | 2 | 702, 801 | To do |
| DSA-801 | Staging and production environments | Deployment | Must | 5 | 102 | To do |
| DSA-802 | Domain, HTTPS and monitoring | Deployment | Must | 3 | 801 | To do |
| DSA-803 | Backups and restore test | Deployment | Must | 2 | 801 | To do |
| DSA-804 | Deploy pipeline and runbook | Deployment | Must | 3 | 801, 103 | To do |
| DSA-805 | Open-source readiness | Deployment | Should | 3 | 101 | To do |

## Suggested sprint plan

Each sprint carries about 25–30 points and ends with a demo. The team should adjust after measuring its real velocity in Sprint 1.

1. **Sprint 1 — Foundations:** DSA-101 to 106, 201, 202, 301, 401. Outcome: app runs locally, database ready, Dynata questions sent, design approved.
2. **Sprint 2 — The redirect loop:** DSA-302 to 306, 601, 801. Outcome: a test respondent can enter, answer and be redirected with a signed URL on staging.
3. **Sprint 3 — Survey engine:** DSA-307, 308, 402, 403, 503, 602. Outcome: screeners and quotas work; all question types render.
4. **Sprint 4 — Respondent experience and quality:** DSA-404, 405, 501, 502, 603, 606, 802, 803. Outcome: full respondent flow with quality checks; surveys built in the admin.
5. **Sprint 5 — Admin and operations:** DSA-604, 605, 607, 309, 406, 504, 701, 804. Outcome: live dashboard, exports, deploy pipeline.
6. **Sprint 6 — Launch readiness:** DSA-702, 703, 704, 805, plus buffer for fixes from Dynata certification. Outcome: certified, soft-launched first project.

## Epic 1 — Project setup

### DSA-101 · Monorepo and shared tooling

*As a developer, I want one repository with shared tooling, so that frontend and backend stay consistent.*

- Repo has `apps/web`, `apps/api` and `packages/shared` as pnpm workspaces.
- TypeScript strict mode, ESLint and Prettier configured once and used by all packages.
- `pnpm lint`, `pnpm typecheck` and `pnpm test` work from the root.

### DSA-102 · Docker Compose local environment

*As a developer, I want to start the whole app with one command, so that onboarding takes minutes.*

- `docker compose up` starts `web`, `api` and PostgreSQL with hot reload.
- Database data persists in a named volume between restarts.
- README explains the command and the local URLs.

### DSA-103 · CI pipeline

*As a team, we want every pull request checked automatically, so that broken code never reaches main.*

- GitHub Actions runs lint, type-check, unit tests and build on every pull request.
- A failing check blocks merge.
- Pipeline finishes in under 10 minutes.

### DSA-104 · Environment config and .env.example

*As a developer, I want all settings in documented environment variables, so that no secret is ever hard-coded.*

- `.env.example` lists every variable with a comment and placeholder value.
- The API validates variables at startup (Zod) and refuses to start if one is missing.
- `.env` is in `.gitignore`.

### DSA-105 · Quick UI prototype in code

*As the product owner, I want a simple working prototype of the main screens, so that I can check the look and flow before building the real features.*

- Built directly in `apps/web` with Claude Code, using Tailwind and shadcn/ui defaults — no Figma.
- Clickable static screens with fake data: welcome, one screen per question type, end screen, admin survey list and dashboard.
- Mobile-first, light and dark mode, readable contrast.
- Product owner reviews it in the browser; agreed tweaks become the design reference for DSA-401.

### DSA-106 · Collect Dynata integration specs

*As the tech lead, I want Dynata's exact technical requirements, so that we build the integration correctly without blocking development.*

- The eight questions from the guide are sent to our Dynata contact on day one.
- Until answers arrive, development uses a **mock Dynata mode**: placeholder parameter name (`rid`), local end-link pages and a simple test HMAC, all configurable.
- When answers arrive, they are stored in `docs/dynata-integration.md` (secrets excluded) and the mock values are replaced in DSA-303 and DSA-304.

## Epic 2 — Data model

### DSA-201 · Prisma schema and first migration

*As a developer, I want a versioned database schema, so that every environment has the same structure.*

- Tables: Survey, Question, ScreeningRule, QuotaCell, Respondent, Answer, RedirectLog, AdminUser, as described in the guide.
- Unique index on (survey id, Dynata respondent ID).
- `prisma migrate dev` creates the schema locally; `prisma migrate deploy` is used in CI and production.
- Shared TypeScript types are generated and exported from `packages/shared`.

### DSA-202 · Demo seed data

*As a contributor, I want a demo survey and fake respondents, so that I can try the app without a Dynata account.*

- `pnpm db:seed` creates one demo survey with every question type, screeners, two quota cells and 50 fake respondents across all outcomes.
- Seed uses obviously fake IDs (e.g. `TEST-0001`) and no real personal data.

## Epic 3 — Dynata integration and survey engine

### DSA-301 · Per-survey Dynata settings

*As an admin, I want Dynata settings stored per survey, so that several Dynata projects can run at the same time.*

- Each survey stores: Dynata project ID, respondent ID parameter name, four end-link templates, signing secret.
- The secret is encrypted at rest and never returned by any API after saving.
- The survey's entry URL is generated and available to copy.

### DSA-302 · Entry endpoint

*As a Dynata panelist, I want to land in the survey straight from my invitation, so that I can start immediately.*

- `GET /s/:surveyId?<rid>=…` creates a Respondent and sets a secure, HTTP-only session cookie, then redirects to the survey page.
- Survey not live → redirect to the over-quota end link.
- Missing respondent ID → friendly error page, no record created.
- Same ID returning while in progress → resumes at their last screen; already finished → quality end link.

### DSA-303 · Incoming signature verification

*As the project owner, I want entry links verified, so that people cannot enter with invented IDs.*

- If Dynata signs entry URLs, the signature is checked using the method from DSA-106.
- Invalid or missing signature → entry refused and logged.
- Can be switched off per survey for test mode only.

### DSA-304 · Signed end-link builder

*As the project owner, I want every redirect back to Dynata signed, so that completes cannot be faked.*

- `buildEndUrl(survey, outcome, respondentId)` in `apps/api/src/dynata/` returns the final URL with ID and hash.
- Hash method matches Dynata's spec exactly (verified against Dynata's examples in unit tests).
- No other part of the code builds Dynata URLs.

### DSA-305 · Finish endpoint and RedirectLog

*As the project owner, I want each respondent's outcome recorded before redirecting, so that our counts match Dynata's invoice.*

- `POST /api/session/finish` sets the final status, runs quality checks, writes a RedirectLog row, and returns the signed URL.
- Calling it again for the same respondent returns the same URL (idempotent).
- Outcomes supported: complete, screenout, overquota, quality.

### DSA-306 · Question delivery and answer API

*As a respondent, I want the right questions in the right order, so that the survey makes sense to me.*

- `GET /api/session/questions` returns the next screen based on display logic; the server decides what comes next.
- `POST /api/session/answers` validates answers with shared Zod schemas and saves them.
- Answers to already-passed screeners cannot be changed.

### DSA-307 · Screening engine

*As a researcher, I want unqualified respondents screened out early, so that we only pay for our target audience.*

- Rules run after each screener answer; a failed rule ends the survey with outcome screenout.
- Supports equals, not equals, in list, ranges, and AND / OR combinations.
- Rules are unit-tested with at least one passing and one failing case each.

### DSA-308 · Quota engine

*As a researcher, I want quotas enforced, so that the sample matches our target mix.*

- A qualified respondent whose quota cell is full ends with outcome overquota.
- Counts increase only on complete, inside a database transaction with row locking.
- 100 simultaneous completes for a cell with 1 slot left produce exactly 1 complete (tested).

### DSA-309 · Pause survey switch

*As an admin, I want to pause a live survey instantly, so that I can stop traffic if something goes wrong.*

- Paused survey sends new entrants to the over-quota end link.
- Respondents already in progress can finish.
- Pause and resume actions are logged with the admin's name.

## Epic 4 — Respondent survey frontend

### DSA-401 · Design system and base components

*As a developer, I want ready-made styled components, so that every screen looks consistent.*

- Tailwind and shadcn/ui set up with colour tokens from the approved Figma design.
- Light and dark mode follow the device setting.
- Base components: button, card option, input, progress bar, error message, page layout.

### DSA-402 · Welcome and consent screen

*As a respondent, I want to know what the survey is and how my data is used, so that I can decide to continue.*

- Shows survey intro, estimated duration and a short privacy notice with a link to the full policy.
- Cloudflare Turnstile check runs before the first question.
- "Start" is the only action; declining sends the respondent to the screen-out end link.

### DSA-403 · Question type components

*As a respondent, I want questions that are easy to answer on my phone, so that I finish quickly and accurately.*

- Components for single choice, multiple choice, grid, open text, number and rating.
- Grids become stacked cards below 640 px width.
- Tap targets at least 44 × 44 px; full keyboard and screen-reader support.
- Options can be randomised per question.

### DSA-404 · Survey flow, autosave and resume

*As a respondent, I want my progress kept, so that a dropped connection does not make me start over.*

- One screen at a time with a progress bar and a fixed "Next" button on phones.
- Answers saved to the server after each screen; inline validation messages.
- Reloading the page returns to the current screen.
- No back navigation into screeners.

### DSA-405 · Redirect and end screens

*As a respondent, I want a clear ending, so that I know I am going back to Dynata.*

- After finish, a short "Thank you, redirecting…" screen shows, then `window.location.replace(signedUrl)`.
- If the redirect fails, a visible "Continue" button with the same URL is shown.
- Screen-out message is polite and neutral.

### DSA-406 · Multi-language support

*As a researcher, I want surveys in several languages, so that we can field in multiple countries.*

- All interface text comes from translation files; English plus one more language at launch.
- Survey questions can store a translation per language.
- Language is chosen from the entry URL parameter or the browser setting.

## Epic 5 — Quality, security and privacy

### DSA-501 · Quality checks module

*As a researcher, I want low-quality responses caught automatically, so that our data is trustworthy.*

- Detects speeders (time below a configurable share of the median), straightlining on grids, and failed attention checks.
- Each check can be set per survey to "flag only" or "terminate as quality".
- Flags are stored on the Respondent and visible in the dashboard and export.

### DSA-502 · Duplicate and bot protection

*As the project owner, I want duplicates and bots blocked, so that we never pay twice or for fake answers.*

- Duplicate Dynata IDs blocked by the unique index (DSA-201).
- Salted IP hash and device signature stored; repeated matches are flagged.
- Hidden honeypot field; filled honeypot → quality termination.

### DSA-503 · Security hardening

*As the project owner, I want the app hardened, so that respondent data and our Dynata account stay safe.*

- Security headers (helmet), strict Content-Security-Policy, HSTS.
- Rate limits on entry endpoint and admin login.
- Cookies are Secure, HttpOnly, SameSite.
- No raw SQL built from user input; `npm audit` runs in CI.

### DSA-504 · Privacy notice and data retention

*As the data controller, we want to meet GDPR duties, so that we can field in Europe and stay compliant.*

- Privacy notice text configurable per survey.
- Retention period configurable per survey; a scheduled job deletes respondent rows and answers after it ends.
- Deletion runs are logged without storing personal data.

## Epic 6 — Admin backend and dashboard

### DSA-601 · Admin authentication and roles

*As an admin, I want a secure login with roles, so that only authorised staff can see and change surveys.*

- Email and password login with Argon2 hashing, or SSO (Google / Microsoft) if chosen.
- Roles: owner (everything), editor (build surveys), viewer (read-only dashboard).
- Sessions expire after inactivity; admin actions are logged.

### DSA-602 · Survey and question CRUD API

*As an editor, I want to create and change surveys through the API, so that the builder UI can manage them.*

- Endpoints to create, read, update, delete and reorder surveys, questions, screening rules and quotas.
- Live surveys cannot have screeners or quotas changed without an explicit confirmation flag.
- All inputs validated with shared Zod schemas.

### DSA-603 · Survey builder UI

*As an editor, I want to build surveys visually, so that I do not need a developer for each project.*

- Add, edit, delete and drag-to-reorder questions of every type.
- Mark questions as screener or attention check; set screening rules and display logic.
- Live preview in a phone-sized frame.
- Status flow: draft → test → live → closed.

### DSA-604 · Quota editor and Dynata settings UI

*As an editor, I want to manage quotas and Dynata links in one place, so that setting up a project is quick.*

- Create quota cells with conditions and targets; progress shown per cell.
- Form for respondent ID parameter, four end links and secret (secret shown masked after saving).
- Entry URL displayed with a copy button.

### DSA-605 · Live fieldwork dashboard

*As a researcher, I want to see fieldwork progress live, so that I can react quickly.*

- Counters: starts, completes, screen-outs, over-quotas, quality terms, incidence rate, median interview length.
- Completes-over-time chart and quota progress bars.
- Table of recent respondents with status and quality flags; refreshes at least every 30 seconds.

### DSA-606 · Test-link generator

*As an editor, I want test links, so that I can check every path without using real Dynata traffic.*

- Generates entry links with IDs prefixed `TEST-`.
- Test respondents land on an internal end page showing the outcome and the URL that would go to Dynata.
- Test data is excluded from live counts and can be deleted in one click.

### DSA-607 · Data export (CSV, SPSS)

*As a researcher, I want to export the data, so that I can analyse it in my usual tools.*

- CSV and SPSS (.sav) exports, one row per respondent, with Dynata ID, status, timings, quality flags and answers.
- Filters: by status, by date range, include or exclude test data.
- Variable labels and value labels included in the SPSS file.

## Epic 7 — Testing and Dynata certification

### DSA-701 · Unit tests for core logic

*As a developer, I want the critical logic fully tested, so that changes never silently break billing or quotas.*

- Tests cover URL signing, screening rules, quota counting under concurrency, quality checks and idempotent finish.
- Coverage of `dynata/`, `quotas/` and `quality/` modules at least 90%.
- Tests run in CI on every pull request.

### DSA-702 · End-to-end tests for every outcome

*As the tech lead, I want every respondent path tested automatically, so that we can release with confidence.*

- Playwright scripts for complete, screen-out, over-quota, quality term, duplicate entry and invalid signature.
- Each test asserts the exact redirect URL and the database status.
- Runs on phone and desktop viewports, against staging, before each production deploy.

### DSA-703 · Load test

*As the project owner, I want to know the app survives a launch burst, so that we do not lose respondents.*

- k6 or Artillery script simulates at least 300 respondents entering within one minute on staging.
- 95% of requests answer in under 500 ms; no errors; no quota overshoot.
- Results saved in `docs/load-test.md`.

### DSA-704 · Dynata certification and soft launch

*As the project owner, I want Dynata to certify the integration, so that the first live project runs smoothly.*

- Dynata runs test links through all end paths and confirms them in writing.
- Soft launch (about 10% of target) reviewed: timings, incidence rate, quality flags, counts matching Dynata.
- Full launch approved by the product owner.

## Epic 8 — Deployment and open source

### DSA-801 · Staging and production environments

*As the tech lead, I want separate staging and production, so that we test every change before respondents see it.*

- Two environments on the chosen platform, each with its own managed PostgreSQL and secrets.
- Staging deploys from `develop`, production from `main`.
- Database hosted in the region agreed for our clients (e.g. EU).

### DSA-802 · Domain, HTTPS and monitoring

*As the project owner, I want a trusted address and alerts, so that respondents trust the link and we hear about problems first.*

- Custom domain (e.g. `survey.ourcompany.com`) with automatic HTTPS.
- `/health` endpoint; uptime monitor alerts the team by email or Slack within 5 minutes of downtime.
- Sentry captures frontend and backend errors.

### DSA-803 · Backups and restore test

*As the project owner, I want reliable backups, so that we never lose fieldwork data.*

- Encrypted daily database backups kept for at least 14 days.
- A restore to a scratch database is tested and documented.

### DSA-804 · Deploy pipeline and runbook

*As a developer, I want deploys to be automatic and reversible, so that releases are boring.*

- Merge to `main` runs tests, builds, migrates and deploys automatically.
- One-step rollback to the previous version.
- `docs/runbook.md` covers deploy, rollback, restore and pausing a live survey.

### DSA-805 · Open-source readiness

*As the project owner, I want the repository safe and welcoming to publish, so that others can use and contribute to it.*

- Licence chosen and approved; README with screenshots and quick start; CONTRIBUTING, CODE\_OF\_CONDUCT, SECURITY and CHANGELOG files.
- Branch protection, secret scanning, push protection, Dependabot and CodeQL enabled.
- Full git history scanned with gitleaks; no secrets, real end links or Dynata documents in the repo.
- Company and Dynata approval to publish confirmed.
