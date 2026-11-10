# Runbook: production

Production runs on one server (Hostinger VPS, Ubuntu 24.04 + Docker) at the domain in
`SITE_DOMAIN`. Setup from scratch: [deploy/README.md](../deploy/README.md).

## Server layout

```
/opt/survey/
  .env                     settings and secrets (server only, never in git)
  releases/<time>-<sha>/   one unpacked copy of the repo per deploy
  current -> releases/…    the release that is running
  backups/*.dump           database dumps, newest 30 kept (pg_dump custom format)
```

Commands below are run on the server as root (`ssh root@<server>`), with
`R=/opt/survey/current/deploy`.

## Deploy

Automatic: merging a PR into `main` runs CI; when CI passes, the **Deploy** workflow
(`.github/workflows/deploy.yml`) uploads the commit to `releases/`, then `deploy/deploy.sh`:

1. backs up the database (`backups/<time>-before-<release>.dump`, checked with `pg_restore --list`),
2. builds and starts the release (the API applies pending migrations at start),
3. waits up to 3 minutes for `https://SITE_DOMAIN/health` to report the database ok,
4. marks it `current`, or, if it is not healthy, starts the previous release again and fails.

Redeploy `main` by hand: GitHub → Actions → Deploy → Run workflow (on `main`).

GitHub setup (once): repository Settings → Environments → `production` → secrets:

| Secret               | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| `DEPLOY_HOST`        | server IP or host name                                       |
| `DEPLOY_SSH_KEY`     | private key of a key pair used only by GitHub Actions        |
| `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 <server>` (checked first) |

The public key goes into `/root/.ssh/authorized_keys` on the server.

## Rollback

One step, to the release before `current`:

```sh
bash $R/rollback.sh
```

Or to a specific release: `bash $R/rollback.sh /opt/survey/releases/<name>`. This rolls back the
code only. If the bad release ran a database migration that the older code cannot handle,
restore the backup taken before it (below).

## Backups and restore

Manual backup: `bash $R/backup.sh <label>`. Copy one off the server with
`scp root@<server>:/opt/survey/backups/<file>.dump .`

These backups sit on the same server: they protect against bad deploys and mistakes, not against
losing the server. Encrypted off-site daily backups are DSA-803.

Restore (replaces all data; stop the API first so no respondent writes in between):

```sh
cd $R
docker compose -f compose.prod.yaml stop api
bash backup.sh before-restore
docker exec -i survey-db-1 sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  < /opt/survey/backups/<file>.dump
docker compose -f compose.prod.yaml start api
```

Test a dump without touching production (scratch database in the same container):

```sh
docker exec survey-db-1 sh -c 'createdb -U "$POSTGRES_USER" restore_test'
docker exec -i survey-db-1 sh -c 'pg_restore -U "$POSTGRES_USER" -d restore_test --no-owner' \
  < /opt/survey/backups/<file>.dump
docker exec survey-db-1 sh -c 'psql -U "$POSTGRES_USER" -d restore_test -c "SELECT count(*) FROM \"Survey\""'
docker exec survey-db-1 sh -c 'dropdb -U "$POSTGRES_USER" restore_test'
```

## Pausing a live survey

Admin → the survey → **Pause survey** (DSA-309). Respondents already in the survey may finish;
new ones are sent back with the over-quota end link. Press **Resume survey** to continue. Use this before a risky deploy or restore while a survey is in
field.

## Looking around

```sh
cd $R
docker compose -f compose.prod.yaml ps
docker compose -f compose.prod.yaml logs api --tail 100
curl https://SITE_DOMAIN/health
```
