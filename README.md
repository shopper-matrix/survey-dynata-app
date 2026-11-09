# Survey Dynata App

pnpm monorepo:

| Path              | What it is                                  |
| ----------------- | ------------------------------------------- |
| `apps/web`        | Frontend (Vite dev server)                  |
| `apps/api`        | Backend API (Node + TypeScript, PostgreSQL) |
| `packages/shared` | Code shared by web and api                  |

## Run the app locally

Prerequisite: [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

```sh
cp .env.example .env    # PowerShell: Copy-Item .env.example .env  (first time only)
docker compose up
```

The first run builds the images and takes a few minutes. Later runs start in seconds. Stop with
`Ctrl+C`, or use `docker compose up -d` to run in the background and `docker compose down` to stop.

### Local URLs

| Service        | URL                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Web app        | http://localhost:5173 (UI prototype: index of every screen, fake data)                          |
| API            | http://localhost:3000 (health check: http://localhost:3000/health)                              |
| API (from web) | http://localhost:5173/api/... is proxied to the API, so the frontend can call `/api/...`        |
| Survey entry   | http://localhost:5173/s/<surveyId>?project=…&psid=…&_k=…&_s=… (signed link, proxied to the API) |
| PostgreSQL     | `localhost:5432`, user/password/database from `POSTGRES_*` in your `.env`                       |

If a port is already taken on your machine, change `WEB_PORT`, `API_PORT` or `POSTGRES_PORT` in `.env`.

## Configuration

All settings are environment variables, documented with placeholders in
[.env.example](.env.example). Your own values go in `.env`, which is git-ignored. Never commit
secrets or hard-code them in source.

- Docker Compose reads `.env` automatically and refuses to start if a required value is missing.
- The API validates its variables at startup with Zod ([apps/api/src/env.ts](apps/api/src/env.ts))
  and exits with a list of every missing or invalid one. New settings must be added to that schema
  and to `.env.example`.
- `POSTGRES_PASSWORD` only applies when the database volume is first created. After changing it,
  reset the database with `docker compose down -v`.

### Hot reload

Your local files are mounted into the containers, so edits apply immediately:

- **web**: Vite updates the page in the browser.
- **api**: `tsx watch` restarts the server.
- Changes in `packages/shared` reload both.

### Database data

Postgres data lives in the named Docker volume `survey-dynata-app_db-data`. It survives
`docker compose down` and restarts. To wipe it and start with an empty database:

```sh
docker compose down -v
```

### After changing dependencies

Dependencies are installed inside the image. After anyone changes a `package.json` or
`pnpm-lock.yaml` (e.g. after a `git pull`), rebuild and refresh the containers' `node_modules`:

```sh
docker compose up --build -V
```

### Troubleshooting

- **`Cannot connect to the Docker daemon` / `connection refused`**: make sure Docker Desktop is
  running. If the `DOCKER_HOST` environment variable is set on your machine, it overrides Docker
  Desktop. Unset it, or run `docker --context desktop-linux compose up`.

## Working outside Docker

Requires Node.js 20+ and pnpm.

```sh
pnpm install
pnpm lint        # ESLint across all packages
pnpm typecheck   # TypeScript (strict) in every package
pnpm test        # Vitest in every package (unit tests, no database needed)
pnpm build       # Production builds (apps/web/dist, apps/api/dist)
pnpm format      # Prettier
```

`lint`, `typecheck` and `test` regenerate the Prisma client first, so a fresh clone works without
extra steps.

## Database

The schema is [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma) (Prisma). The
generated client and types live in `packages/shared/src/generated` (not committed) and are
exported as `@survey-dynata/shared/db` (types and enums, safe for the browser) and
`@survey-dynata/shared/db/client` (database client, API only).

```sh
pnpm db:migrate --name add-something   # change the schema: create + apply a migration (dev)
pnpm db:deploy                         # apply pending migrations (CI, production)
pnpm db:generate                       # regenerate the client after a schema change
pnpm db:seed                           # (re)create the demo survey with 50 fake respondents
pnpm --filter @survey-dynata/api test:db   # database tests (needs a running database)
```

### Demo data

`pnpm db:seed` (or `docker compose exec api pnpm db:seed`) creates the survey "Demo: Snack Bar
Study": one question of every type, two screeners, two quota cells and 50 fake respondents
(`TEST-0001` … `TEST-0050`) across all outcomes. Running it again replaces the demo survey; it
refuses to run with `NODE_ENV=production`. No real personal data is involved.

### Importing a questionnaire

```sh
pnpm survey:import path/to/survey.json
```

Validates a survey definition (format: [packages/shared/src/survey-definition.ts](packages/shared/src/survey-definition.ts))
and writes it as a draft. Re-importing replaces the survey, unless it already has respondents.
Client questionnaires are confidential: keep their definition files in the git-ignored `private/`
folder, never elsewhere in the repo.

`docker compose up` applies pending migrations automatically when the API starts. Commands run on
your machine use `DATABASE_URL` from `.env` (pointing at `localhost:5432`).

## CI

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs format check, lint,
typecheck, tests and build on every pull request and on pushes to `dev` and `main`. Run the same
commands locally before opening a PR.
