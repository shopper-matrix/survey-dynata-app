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
7. **Mock Dynata mode until the specs arrive** (DSA-106): respondent ID parameter `rid`, local
   end-link pages instead of Dynata URLs, and a simple test HMAC, all configurable via env.
   Real values replace the mocks in DSA-303 / DSA-304 and are recorded in
   `docs/dynata-integration.md` (no secrets).

## Repository

pnpm workspaces monorepo:

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
```

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

- `main` = production, `dev` = integration/staging. (The backlog says `develop`; this repo uses `dev`.)
- One branch per story: `feature/DSA-xxx-short-name` → pull request into `dev`.
  CI (`.github/workflows/ci.yml`) must pass: format check, lint, typecheck, test, build.
- Commit identity for this repo: `shopper-matrix <aboukinana@shoppermetrics.com>` (repo-local config).

## Status and deviations from the guide

- Done: DSA-101 … DSA-104 (committed before the Conventional Commits rule; messages not rewritten).
- Next: DSA-105 (UI prototype in code).
- Deviations to keep in mind:
  - The API is currently a plain `node:http` server. Fastify comes in with the first real routes.
  - Postgres is 18 (guide: 16).
  - Node 26 is used locally, in Docker and in CI (guide: 20 LTS; `engines` allows >=20).
  - The compose file is `compose.yaml` (guide: `docker-compose.yml`).
