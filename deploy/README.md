# Deploy: production and staging on one server

Runs the app on one Linux server with Docker, as two stacks (production from `main`, staging
from `dev`), each with PostgreSQL, the API (applies pending migrations at every start) and a web
container serving the built frontend. One [Caddy](https://caddyserver.com/) edge proxy in front
gets the HTTPS certificates and routes `/api/…`, `/s/…`, `/mock-dynata/…` and `/health` to the
API, everything else to the frontend. Day-to-day operation (automatic deploys, rollback,
backups, restore): [docs/runbook.md](../docs/runbook.md).

| File                | What it is                                                        |
| ------------------- | ----------------------------------------------------------------- |
| `Dockerfile.prod`   | Builds the monorepo; targets `api` (Node) and `web` (Caddy, HTTP) |
| `compose.prod.yaml` | One stack: database, API, web; project name from `STACK_NAME`     |
| `Caddyfile`         | Web container: serves the frontend with security headers          |
| `edge/compose.yaml` | The edge proxy on ports 80/443                                    |
| `edge/Caddyfile`    | HTTPS and routing for both domains, `www.` redirect               |
| `deploy.sh`         | Backup, build and start a release, health check, rollback if bad  |
| `rollback.sh`       | Starts the previous release again                                 |
| `backup.sh`         | Database dump into `<stack>/backups`                              |
| `lib.sh`            | Functions shared by the scripts above                             |
| `pull-backup.ps1`   | Run on your computer: fresh backup, downloaded and checked        |
| `.env`              | Link to the stack's `.env`, created by the scripts (never commit) |

## First setup

Prerequisites: a server with Docker and Docker Compose, ports 80 and 443 open, and DNS `A`
records for `SITE_DOMAIN`, `www.SITE_DOMAIN` and `STAGING_DOMAIN` pointing at it (Caddy needs
them to get the certificates).

1. Create the two `.env` files on the server, generating the secrets there:

   ```sh
   umask 077
   mkdir -p /opt/survey /opt/survey-staging
   cat > /opt/survey/.env <<EOF
   STACK_NAME=survey
   SITE_DOMAIN=survey.example.com
   STAGING_DOMAIN=staging.survey.example.com
   MANAGE_EDGE=true
   POSTGRES_PASSWORD=$(openssl rand -hex 24)
   SESSION_SECRET=$(openssl rand -hex 32)
   DYNATA_MODE=mock
   EOF
   cat > /opt/survey-staging/.env <<EOF
   STACK_NAME=survey-staging
   SITE_DOMAIN=staging.survey.example.com
   POSTGRES_PASSWORD=$(openssl rand -hex 24)
   SESSION_SECRET=$(openssl rand -hex 32)
   DYNATA_MODE=mock
   EOF
   ```

   Optional: `POSTGRES_USER`, `POSTGRES_DB`, `ADMIN_SESSION_IDLE_MINUTES`, the `DYNATA_*` keys
   (required for `DYNATA_MODE=live`) and `TURNSTILE_*` keys. Their meaning is documented in
   [../.env.example](../.env.example). `POSTGRES_PASSWORD` only applies when the database volume
   is first created.

2. Set up the GitHub secrets (runbook, "Deploy") and run the **Deploy** workflow on `main`, then
   on `dev`. Production first: it starts the edge proxy. Without GitHub: unpack
   `git archive main` into `/opt/survey/releases/<time>-<sha>` and run
   `bash /opt/survey/releases/<time>-<sha>/deploy/deploy.sh /opt/survey/releases/<time>-<sha>`.
3. Create the first admin in each stack (the password is printed once):

   ```sh
   cd /opt/survey/current/deploy      # or /opt/survey-staging/current/deploy
   docker compose -f compose.prod.yaml exec api pnpm admin:create you@example.com owner
   ```

Database data (`survey_db-data`, `survey-staging_db-data`) and certificates (`edge_caddy-data`)
are Docker volumes and survive deploys. `docker compose … down -v` deletes them.

## Not covered yet

Managed database and agreed region (DSA-801), uptime monitoring and Sentry (DSA-802),
automated encrypted off-site backups (DSA-803 uses a daily manual download instead).
