# Database Backup & Restore

The Supabase org is on the **free plan**, which has **no automatic backups**.
This repo covers that gap with a GitHub Actions workflow
(`.github/workflows/db-backup.yml`) that dumps the database daily at 02:00
Dhaka time and keeps each dump as a workflow artifact for **30 days**.

Each backup contains three gzipped SQL files made with the Supabase CLI:

| File | Contents |
| --- | --- |
| `roles.sql.gz` | database roles |
| `schema.sql.gz` | tables, functions, RLS policies, triggers |
| `data.sql.gz` | all table data (`COPY` format) |

## One-time setup

1. Supabase Dashboard → project **3i-ERP-WMS** → **Connect** → copy the
   **Session pooler** connection string (the direct `db.…supabase.co` host is
   IPv6-only and unreachable from GitHub runners). It looks like:
   `postgresql://postgres.kstwbkwbsozaboceksmy:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`
2. Fill in the database password (Dashboard → Settings → Database → reset it
   if you don't have it).
3. GitHub repo → **Settings → Secrets and variables → Actions → New repository
   secret** → name `SUPABASE_DB_URL`, value = that connection string.
4. Test it: **Actions → Daily DB Backup → Run workflow**. A successful run
   shows a `db-backup-run…` artifact at the bottom of the run page.

## Downloading a backup

GitHub → **Actions → Daily DB Backup** → pick a run → download the artifact
zip. Keep an occasional copy somewhere outside GitHub (Drive, local disk) for
anything you may need beyond the 30-day artifact window.

## Restoring after a crash / data loss

Restore into a fresh project (or the same one after fixing the incident):

```bash
# unzip the artifact first, then:
gunzip roles.sql.gz schema.sql.gz data.sql.gz

psql "$DB_URL" -f roles.sql
psql "$DB_URL" -f schema.sql
psql "$DB_URL" -f data.sql
```

`DB_URL` is the session-pooler connection string of the target project.
If restoring into a brand-new Supabase project, update `.env` /
Cloudflare-Vercel env vars with the new project URL + anon key afterwards,
and re-run `npm run typegen` against the new project id.

## What this does NOT cover

- **Storage buckets** (uploaded files/images) — the dump is database-only.
- **Point-in-time recovery** — you can lose up to 24h of changes between
  dumps. If that risk becomes unacceptable, upgrade to Supabase Pro
  (daily managed backups) and optionally the PITR add-on.
