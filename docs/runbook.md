# Runbook: production and staging

Both environments run on one server (Hostinger VPS, Ubuntu 24.04 + Docker), each as its own
Docker Compose stack with its own database and secrets. Setup from scratch:
[deploy/README.md](../deploy/README.md).

| Environment | Branch | Address                         | Stack directory       | Containers         |
| ----------- | ------ | ------------------------------- | --------------------- | ------------------ |
| production  | `main` | `SITE_DOMAIN` (serafima.cloud)  | `/opt/survey`         | `survey-*`         |
| staging     | `dev`  | `STAGING_DOMAIN` (staging.…)    | `/opt/survey-staging` | `survey-staging-*` |

The edge proxy (`edge-caddy-1`, [deploy/edge](../deploy/edge)) is the only container on ports
80/443: it gets the HTTPS certificates and routes each domain to its stack. It is (re)started by
production deploys. Staging pages are sent with `X-Robots-Tag: noindex`.

## Server layout

```
/opt/survey/                 production (same layout in /opt/survey-staging)
  .env                       settings and secrets (server only, never in git)
  releases/<time>-<sha>/     one unpacked copy of the repo per deploy
  current -> releases/…      the release that is running
  backups/*.dump             database dumps, newest 30 kept (pg_dump custom format)
```

Commands below are run on the server as root (`ssh root@<server>`), with
`R=/opt/survey/current/deploy` for production or `R=/opt/survey-staging/current/deploy` for
staging.

## Deploy

Automatic: a push to `dev` (staging) or a merged PR into `main` (production) runs CI; when CI
passes, the **Deploy** workflow (`.github/workflows/deploy.yml`) uploads the commit to the
stack's `releases/`, then `deploy/deploy.sh`:

1. backs up the database (`backups/<time>-before-<release>.dump`, checked with `pg_restore --list`),
2. builds and starts the release (the API applies pending migrations at start),
3. waits up to 3 minutes for the API, its database and the web container to answer, and reports
   whether the public `https://…/health` answers too,
4. marks it `current`, or, if it is not healthy, starts the previous release again and fails.

Redeploy by hand: GitHub → Actions → Deploy → Run workflow, on `main` or `dev`.

GitHub setup (once): repository Settings → Secrets and variables → Actions → New repository
secret:

| Secret               | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| `DEPLOY_HOST`        | server IP or host name                                       |
| `DEPLOY_SSH_KEY`     | private key of a key pair used only by GitHub Actions        |
| `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 <server>` (checked first) |

The public key goes into `/root/.ssh/authorized_keys` on the server. GitHub creates the
`production` and `staging` environments on the first deploy (deploy history per environment).

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
losing the server.

### Daily copy to your computer (DSA-803)

Once a day, on a Windows computer with the server's SSH key, from the repository folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\pull-backup.ps1
```

It makes a fresh production backup on the server, downloads it to
`Documents\survey-backups`, checks the SHA-256 checksum and deletes local copies older than 14
days. Options: `-Destination <folder>`, `-KeepDays <n>`, `-Stack /opt/survey-staging`,
`-Server`, `-KeyFile`.

The dumps contain respondent data: keep them only on an encrypted disk (BitLocker / Windows
device encryption, or an encrypted external drive), never in a synced or shared folder.

To run it automatically every day (Task Scheduler, while you are logged in):

```powershell
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-ExecutionPolicy Bypass -File "<repo>\deploy\pull-backup.ps1"'
$trigger = New-ScheduledTaskTrigger -Daily -At 9am
Register-ScheduledTask -TaskName 'Survey backup' -Action $action -Trigger $trigger
```

To restore a downloaded copy, upload it first, then follow the restore steps below:
`scp -i <key> <file>.dump root@<server>:/opt/survey/backups/`

Restore (replaces all data; stop the API first so no respondent writes in between; use
`survey-staging-db-1` for staging):

```sh
cd $R
docker compose -f compose.prod.yaml stop api
bash backup.sh before-restore
docker exec -i survey-db-1 sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  < /opt/survey/backups/<file>.dump
docker compose -f compose.prod.yaml start api
```

Test a dump without touching the live data (scratch database in the same container):

```sh
docker exec survey-db-1 sh -c 'createdb -U "$POSTGRES_USER" restore_test'
docker exec -i survey-db-1 sh -c 'pg_restore -U "$POSTGRES_USER" -d restore_test --no-owner' \
  < /opt/survey/backups/<file>.dump
docker exec survey-db-1 sh -c 'psql -U "$POSTGRES_USER" -d restore_test -c "SELECT count(*) FROM \"Survey\""'
docker exec survey-db-1 sh -c 'dropdb -U "$POSTGRES_USER" restore_test'
```

## Pausing a live survey

Admin → the survey → **Pause survey** (DSA-309). Respondents already in the survey may finish;
new ones are sent back with the over-quota end link. Press **Resume survey** to continue. Use
this before a risky deploy or restore while a survey is in field.

## Looking around

```sh
cd $R
docker compose -f compose.prod.yaml ps
docker compose -f compose.prod.yaml logs api --tail 100
docker logs edge-caddy-1 --tail 50        # HTTPS certificates, routing
curl https://SITE_DOMAIN/health
```
