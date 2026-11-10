# Production deploy (single server)

Runs the whole app on one Linux server with Docker: PostgreSQL, the API and
[Caddy](https://caddyserver.com/) (HTTPS, serves the built frontend, forwards `/api/…`, `/s/…`,
`/mock-dynata/…` and `/health` to the API). The API applies pending migrations at every start.
Day-to-day operation (automatic deploys, rollback, backups, restore): [docs/runbook.md](../docs/runbook.md).

| File                | What it is                                                        |
| ------------------- | ----------------------------------------------------------------- |
| `Dockerfile.prod`   | Builds the monorepo; targets `api` (Node) and `web` (Caddy)       |
| `compose.prod.yaml` | The three services, volumes for database and certificates         |
| `Caddyfile`         | HTTPS for `SITE_DOMAIN`, `www.` redirect, security headers        |
| `deploy.sh`         | Backup, build and start a release, health check, rollback if bad  |
| `rollback.sh`       | Starts the previous release again                                 |
| `backup.sh`         | Database dump into `/opt/survey/backups`                          |
| `lib.sh`            | Functions shared by the scripts above                             |
| `.env`              | Link to `/opt/survey/.env`, created by the scripts (never commit) |

## First setup

Prerequisites: a server with Docker and Docker Compose, ports 80 and 443 open, and DNS `A`
records for `SITE_DOMAIN` and `www.SITE_DOMAIN` pointing at it (Caddy needs them to get the
certificates).

1. Create `/opt/survey/.env` on the server, generating the secrets there:

   ```sh
   mkdir -p /opt/survey && cd /opt/survey
   umask 077
   cat > .env <<EOF
   SITE_DOMAIN=survey.example.com
   POSTGRES_PASSWORD=$(openssl rand -hex 24)
   SESSION_SECRET=$(openssl rand -hex 32)
   DYNATA_MODE=mock
   EOF
   ```

   Optional: `POSTGRES_USER`, `POSTGRES_DB`, `ADMIN_SESSION_IDLE_MINUTES`, the `DYNATA_*` keys
   (required for `DYNATA_MODE=live`) and `TURNSTILE_*` keys. Their meaning is documented in
   [../.env.example](../.env.example). `POSTGRES_PASSWORD` only applies when the database volume
   is first created.

2. Set up the GitHub secrets (runbook, "Deploy") and run the **Deploy** workflow on `main`.
   Without GitHub: unpack `git archive main` into `/opt/survey/releases/<time>-<sha>` and run
   `bash /opt/survey/releases/<time>-<sha>/deploy/deploy.sh /opt/survey/releases/<time>-<sha>`.
3. Create the first admin (the password is printed once):

   ```sh
   cd /opt/survey/current/deploy
   docker compose -f compose.prod.yaml exec api pnpm admin:create you@example.com owner
   ```

Database data (`survey_db-data`) and certificates (`survey_caddy-data`) are Docker volumes and
survive deploys. `docker compose … down -v` deletes them.

## Not covered yet

Staging environment, managed database and region (DSA-801), uptime monitoring and Sentry
(DSA-802), encrypted off-site daily backups (DSA-803).
