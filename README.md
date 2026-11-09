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

| Service        | URL                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------- |
| Web app        | http://localhost:5173                                                                    |
| API            | http://localhost:3000 (health check: http://localhost:3000/health)                       |
| API (from web) | http://localhost:5173/api/... is proxied to the API, so the frontend can call `/api/...` |
| PostgreSQL     | `localhost:5432`, user/password/database from `POSTGRES_*` in your `.env`                |

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
pnpm test        # Vitest in every package
pnpm build       # Production builds (apps/web/dist, apps/api/dist)
pnpm format      # Prettier
```

## CI

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs format check, lint,
typecheck, tests and build on every pull request and on pushes to `dev` and `main`. Run the same
commands locally before opening a PR.
