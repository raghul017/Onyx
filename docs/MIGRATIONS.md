# Database Migrations

Onyx uses **Prisma Migrate** as the single source of truth for the database
schema. All commands below run from the `server/` directory.

> **Do not use `npx prisma db push` anymore.** `db push` mutates the live schema
> with no history and can silently drop columns/data. It is kept in
> `package.json` only as a last-resort local escape hatch — never run it against
> a shared or production database.

## History

- **Baselined from `db push` on 2026-07-13.** The production Neon database was
  created and evolved with `prisma db push` (no migration history). On this date
  we generated an initial migration representing the exact current schema and
  marked it as already-applied on the live DB, so no DDL was re-run and **no data
  was touched**.
- Initial migration: `prisma/migrations/20260713173225_init/`
- Baseline command used (data-safe — records the migration as applied, runs no SQL):
  ```bash
  npx prisma migrate resolve --applied 20260713173225_init
  ```
- Verified with `npx prisma migrate status` → _"Database schema is up to date!"_
  and `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`
  → _"No difference detected."_ (zero drift).

## How the app applies migrations

`npm start` runs `prisma migrate deploy` **before** booting the server:

```json
"start": "prisma migrate deploy && node dist/index.js"
```

`migrate deploy` applies only pending, already-created migrations. It never
generates new SQL and never prompts — safe for production/CI boot. On a host
(e.g. Render) that uses a custom start command, set it to `npm start` (or add
`npx prisma migrate deploy` before the node start command).

`prisma.config.ts` loads `.env` via `dotenv/config`, so `DATABASE_URL` resolves
for every `prisma` CLI command locally. In production, env vars are set directly
and the `.env` load is a harmless no-op.

## Creating a new migration (schema change workflow)

1. Edit `prisma/schema.prisma`.
2. Create + apply the migration against your **local/dev** database:
   ```bash
   npm run db:migrate -- --name <descriptive_name>   # prisma migrate dev
   ```
   This writes `prisma/migrations/<timestamp>_<name>/migration.sql` and updates
   the Prisma Client.
3. Commit the new migration directory alongside the schema change.
4. On deploy, `npm start` runs `prisma migrate deploy` and applies it.

### Useful scripts

| Script              | Command                   | Purpose                                   |
| ------------------- | ------------------------- | ----------------------------------------- |
| `npm run db:migrate`| `prisma migrate dev`      | Create + apply a migration (local dev).   |
| `npm run db:deploy` | `prisma migrate deploy`   | Apply pending migrations (prod/CI/boot).  |
| `npm run db:generate`| `prisma generate`        | Regenerate the Prisma Client.             |
| `npm run db:studio` | `prisma studio`           | Browse data.                              |
| `npm run db:push`   | `prisma db push`          | ⚠️ Escape hatch only — avoid.             |

## Baselining another environment from `db push`

If you have another database that predates migrations (also built with `db push`
and already matching `schema.prisma`), baseline it the same way — this only
records the migration as applied and runs no SQL:

```bash
# From server/, with DATABASE_URL pointing at that database:
npx prisma migrate resolve --applied 20260713173225_init
npx prisma migrate status   # expect: "Database schema is up to date!"
```

If a database does **not** yet have the tables, run `npx prisma migrate deploy`
instead (it will create everything from the migration history).
