# Production deploy (single server)

Runs the whole app on one Linux server with Docker: PostgreSQL, the API and
[Caddy](https://caddyserver.com/) (HTTPS, serves the built frontend, forwards `/api/…`, `/s/…`,
`/mock-dynata/…` and `/health` to the API). The API applies pending migrations at every start.

| File                | What it is                                                      |
| ------------------- | --------------------------------------------------------------- |
| `Dockerfile.prod`   | Builds the monorepo; targets `api` (Node) and `web` (Caddy)     |
| `compose.prod.yaml` | The three services, volumes for database and certificates       |
| `Caddyfile`         | HTTPS for `SITE_DOMAIN`, `www.` redirect, security headers      |
| `.env`              | Server-only settings and secrets (git-ignored, never commit it) |

## First setup

Prerequisites: a server with Docker and Docker Compose, ports 80 and 443 open, and DNS `A`
records for `SITE_DOMAIN` and `www.SITE_DOMAIN` pointing at it (Caddy needs them to get the
certificates).

1. Copy the repository to the server, e.g. `git archive --format=tar.gz -o app.tar.gz main` and
   unpack it in `/opt/survey/app`.
2. Create `deploy/.env` on the server, generating the secrets there:

   ```sh
   cd /opt/survey/app/deploy
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

3. Start: `docker compose -f compose.prod.yaml up -d --build`
4. Create the first admin (the password is printed once):

   ```sh
   docker compose -f compose.prod.yaml exec api pnpm admin:create you@example.com owner
   ```

5. Check `https://SITE_DOMAIN/health` returns `{"status":"ok","database":"ok",…}`.

## Updating

Replace the code in `/opt/survey/app` with the new `main` (keep `deploy/.env`), then rebuild:

```sh
cd /opt/survey/app/deploy
docker compose -f compose.prod.yaml up -d --build
```

Database data (`survey_db-data`) and certificates (`survey_caddy-data`) are Docker volumes and
survive rebuilds. `docker compose … down -v` deletes them.

## Not covered yet

Staging environment, managed database and region (DSA-801), uptime monitoring and Sentry
(DSA-802), backups (DSA-803) and an automated deploy pipeline (DSA-804).
