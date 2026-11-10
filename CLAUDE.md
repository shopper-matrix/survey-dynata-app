# CLAUDE.md

## Project

Open-source web app that hosts our own surveys and receives respondents from Dynata's panel.
Dynata sends a respondent in → we show questions, screen, enforce quotas, store answers → we send
them back with exactly one signed end link (complete / screenout / overquota / quality). Our
server is the single source of truth for each outcome; Dynata bills on the end link it receives.

Three parts: mobile-first **respondent survey**, **admin dashboard** (builder, quotas, live
stats, export), **API** (Dynata redirects, screening, quotas, storage, security).

Source documents (read the relevant section before each story):

- [docs/Implementation_guide.md](docs/Implementation_guide.md): architecture, data model, Dynata flow, design, security
- [docs/Backlog.md](docs/Backlog.md): stories DSA-101 … DSA-805 with acceptance criteria and dependencies

## Working rules

1. **One story at a time, in backlog order**, starting with DSA-101. Don't start the next story
   until the current one is done.
2. **Plan first.** Before writing code for a story, show a short plan (approach, files, new
   dependencies, open questions) and wait for approval.
   _Exception (product owner, Nov 2026):_ the remaining backlog was approved as one compact plan
   in milestones M1 Survey engine (307, 305 core, 308) → M2 Admin backend (601, 602, 309, 606, 607) → M3 Respondent UI (401–406) → M4 Admin UI (603–605) → M5 Quality & security (501–504)
   → M6 Testing (701–703) → M7 Deploy & open source (801–805). Build them in that order without
   per-story approval; still one commit per story, and ask when a story needs an account or a
   decision only the product owner can make. Parked: 303, 304, 704.
3. **Definition of done:** every acceptance criterion passes (verified, not assumed) **and**
   `pnpm lint`, `pnpm typecheck` and `pnpm test` succeed.
4. **Exactly one commit per story**, Conventional Commits with the story ID as scope, e.g.
   `feat(DSA-101): set up pnpm monorepo and shared tooling`. Use `feat`, `fix`, `chore`, `docs`,
   `test`, `ci` as fitting.
5. **Clean code:** TypeScript strict, no unused code or dead placeholders, small focused files.
   All Dynata-specific code lives in `apps/api/src/dynata/`. Nothing outside it builds Dynata
   URLs or knows Dynata parameter names.
6. **Never commit secrets.** Every setting is an environment variable documented with a
   placeholder in `.env.example`; real values only in `.env` (git-ignored).
7. **Dynata modes** (`DYNATA_MODE`, default `mock`). Dynata's spec is in
   `docs/dynata-integration.md` (HMAC-SHA256 signed links, `psid`, one key ID + secret per
   client, `buildAndValidate` API). `live` calls Dynata's API; `mock` verifies and signs
   locally with the same algorithm and points end links at local pages. Develop and test in
   mock mode; never call Dynata's real API from tests.

## Repository

pnpm workspaces monorepo:

- `e2e`: Playwright end-to-end tests (reuse the API's importer and Dynata provider for exact links)
- `apps/web`: frontend (Vite; React + Tailwind + shadcn/ui per the guide)
- `apps/api`: backend (Node + TypeScript; env validated with Zod in `src/env.ts`)
- `packages/shared`: code and Zod schemas shared by both apps (consumed as TS source)

Target API layout from the guide: `apps/api/src/{routes,dynata,quality,quotas}/`, `apps/api/prisma/`.

## Commands

```sh
cp .env.example .env         # once
docker compose up            # web :5173, api :3000 (/health), postgres :5432, hot reload
pnpm lint | pnpm typecheck | pnpm test | pnpm build | pnpm format
docker compose up --build -V # after any package.json / lockfile change
docker compose down -v       # wipe the local database
pnpm db:migrate --name <change>  # schema change → new migration (never edit applied ones)
pnpm --filter @survey-dynata/api test:db  # DB integration tests (*.db.test.ts, need a database)
pnpm --filter @survey-dynata/api test:coverage  # all API tests; dynata/, quotas/, quality/ must stay >= 90%
pnpm --filter @survey-dynata/e2e e2e  # Playwright, every respondent path (starts servers unless running)
```

## Database (Prisma 7)

- Schema: `apps/api/prisma/schema.prisma`; config: `apps/api/prisma.config.ts` (loads root `.env`).
- The client is generated into `packages/shared/src/generated/prisma` (git-ignored). Import types
  and enums from `@survey-dynata/shared/db` (browser-safe) and the client only in the API via
  `@survey-dynata/shared/db/client` (`apps/api/src/db.ts`).
- Questions are generic: `type` enum + `config` JSON validated per type with Zod
  (`packages/shared/src/questions/config.ts`). A new question type adds an enum value and a
  config schema, not a table. Conditions (screening, quotas, display logic) use
  `packages/shared/src/conditions.ts`. Answer value shapes are documented in
  `apps/api/src/seed/demo-answers.ts` until DSA-306 makes them a shared schema.
- `Answer.question` is `onDelete: Restrict`: delete answers before deleting a survey's questions.
- `Respondent.panelRespondentId` is provider-neutral; Dynata names stay in `apps/api/src/dynata/`.
- `docs/Fragebogen.md` (client questionnaire, git-ignored, never commit) is the reference survey
  the question types must support.

## Conventions

- Shared configs live at the root only: `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`), `eslint.config.js` (typescript-eslint strict type-checked),
  `.prettierrc.json`. Packages only extend them.
- Tests: Vitest, colocated as `*.test.ts`. Playwright for end-to-end (DSA-702).
- The API reads `process.env` only through `loadEnv()` in `apps/api/src/env.ts`. A new
  variable goes into that schema **and** `.env.example`.
- Validate every input with Zod; schemas shared between web and api go in `packages/shared`.
- TypeScript is pinned to 6.0.x: typescript-eslint doesn't support TypeScript 7 yet.
- New dependencies that run install scripts must be allowed in `pnpm-workspace.yaml`
  (`allowBuilds`).

## Git workflow

- `main` = production and the default branch. Changes reach it only through a pull request from `dev`.
- `dev` = the working branch (the backlog calls it `develop`). Story commits go directly on `dev`.
- CI (`.github/workflows/ci.yml`) runs on pushes to `dev`/`main` and on every PR, and must pass:
  format check, lint, typecheck, test, build.
- Commit identity for this repo: `shopper-matrix <aboukinana@shoppermetrics.com>` (repo-local config).

## Status and deviations from the guide

- Done: DSA-101 … DSA-104 (committed before the Conventional Commits rule; messages not rewritten).
- DSA-105 done: clickable prototype (shadcn/ui radix-nova preset, Tailwind v4); it was the design
  reference and was deleted in DSA-605 once every screen had a real counterpart.
- DSA-106 is postponed (user's decision); mock Dynata mode still applies.
- DSA-201 done: Prisma schema + first migration; CI runs `migrate deploy` and DB tests against a
  Postgres service.
- DSA-202 done: `pnpm db:seed` → demo survey (every question type) + 50 fake respondents
  (`apps/api/src/seed/`).
- DSA-301 done: `apps/api/src/dynata/` (config, signature, client mock/live, entry URL) and
  `DynataSurveySettings` (survey ↔ project ID). Backlog DSA-301…305/503 were rewritten after
  Dynata's signed-link document (end links come pre-signed from the API at entry).
- DSA-302 done: Fastify app (`src/app.ts` builds, `src/server.ts` starts), entry route
  `GET /s/:surveyId` behind the provider-neutral `providers/sample-provider.ts` interface,
  signed `respondent` session cookie (`SESSION_SECRET`). In development `APP_BASE_URL` is the web
  dev server (http://localhost:5173), which proxies `/s/` and `/mock-dynata/` to the API.
  Quality outcome uses Dynata's screen-out link until Dynata answers (`dynata/provider.ts`).
- DSA-203 done: survey definition format (`packages/shared/src/survey-definition.ts`) and
  `pnpm survey:import <file>` (same writer as the demo seed). The real Rawbite questionnaire is
  `private/surveys/rawbite-phase2.json` (git-ignored, client content: never commit, never copy
  its texts into committed files). Gaps the engine can't express yet are in each question's
  `notes`.
- **DSA-303…305 are parked until the end** (product owner, Nov 2026): Dynata security mode and
  quality flag must be confirmed first; their revised plan is in `docs/Backlog.md`. Keep working
  in mock mode.
- DSA-306 done: respondent session API `GET /api/session/questions`, `POST /api/session/answers`
  (`routes/session.ts`). The flow engine (`apps/api/src/survey-flow/`) is pure: `walkSurvey`
  decides the next screen (block order incl. rotation, display logic, piping, seeded per-respondent
  randomisation, split cells); `resolveWalk` persists block order and balanced test-group
  assignments (`$blockOrder`, `$strata` keys in `Respondent.assignments`). Answer formats and the
  condition evaluator live in `packages/shared` (`answers.ts`, `evaluate-condition.ts`).
  API routes are under `/api/…`; the Vite proxy no longer strips the prefix.
  DB tests run one file at a time (`test:db`), since they share one database.
- Done since (one commit each): 307, 305 core, 308, 601, 602, 309, 606, 607, 401–406, 603, 604, 605, 501, 502, 503, 504, 701, 702.
  Admin UI lives in `apps/web/src/admin/` (builder tabs: Questions / Quotas / Dynata); per-survey
  provider settings come from the optional `SampleProvider.registerAdminRoutes` hook
  (`dynata/admin-routes.ts`). Live stats: `GET /api/admin/surveys/:id/stats` (`stats/fieldwork.ts`,
  test respondents excluded; incidence = completes / (completes + screen-outs)).
- DSA-501: quality checks run at finish before quotas (`quality/`; `chainHooks` in `app.ts`).
  Settings per survey in `Survey.qualitySettings` (`packages/shared/src/quality-settings.ts`;
  edited in the builder's Settings tab, or `survey.quality` in an import file). Attention checks
  need `attentionAnswer` ({ row?, expected }), editable in the question editor.
- DSA-502: entry stores HMAC hashes of IP and device signature (`quality/fingerprint.ts`, keyed
  with `SESSION_SECRET`) and flags `duplicate_ip` / `duplicate_device`; `TRUST_PROXY=true` behind a
  reverse proxy. Hidden honeypot field `hp` in answers → quality termination (`honeypot` flag).
- DSA-503: helmet with a script-free CSP, HSTS and frame-ancestors none on the API
  (`http/security.ts`); the web build gets a CSP meta tag (`apps/web/vite.config.ts`; frame-ancestors
  must come from the host, DSA-801). Entry links are rate-limited per IP. ESLint bans
  `$queryRawUnsafe`/`$executeRawUnsafe`; CI runs `pnpm audit --audit-level high`.
- DSA-504: Settings tab edits welcome texts, privacy notice and `Survey.retentionDays` (null = keep).
  `retention/` deletes respondents (answers, redirect logs) that many days after they finished;
  runs at API start and daily (`scheduleRetention` in `server.ts`); `RetentionRun` logs counts only.
- DSA-701: `apps/api/vitest.config.ts` enforces 90% coverage of `dynata/`, `quotas/`, `quality/`;
  CI runs it with the database tests.
- DSA-702: `e2e/` covers complete, screen-out, over-quota, quality, duplicate entry and invalid
  signature on phone and desktop, asserting exact end URLs and DB status; runs in CI. Mock mode
  only; `E2E_BASE_URL` targets staging once it exists (DSA-801).
- Waiting for product-owner input: 703 (needs staging), 801–804 (hosting, region, domain,
  monitoring accounts), 805 (licence, publication approval). Parked: 303, 304, 704.
- DSA-801 started (product owner, Nov 2026): production runs from `main` on one Hostinger VPS
  (Ubuntu 24.04 + Docker) at https://serafima.cloud, mock Dynata mode, via `deploy/`
  (`compose.prod.yaml`: Postgres, API, Caddy for HTTPS). Staging, managed database/region,
  monitoring, backups and a deploy pipeline are still open (801–804); see `deploy/README.md`.
- DSA-106 open questions (quality-termination link, API limits…) are listed in
  `docs/dynata-integration.md`.
- Light-mode `--muted-foreground` is darkened to `oklch(0.53 0 0)` (shadcn default 0.556) for WCAG AA.
- Deviations to keep in mind:
  - Prisma 7.10 doesn't list Node 26 as supported yet (20.19+, 22.12+, 24+). It works here
    (generate, migrate, queries tested), but switch Docker/CI to Node 24 if problems appear.
  - Postgres is 18 (guide: 16).
  - Node 26 is used locally, in Docker and in CI (guide: 20 LTS; `engines` allows >=20).
  - The compose file is `compose.yaml` (guide: `docker-compose.yml`).
