# Database Migrations

Migrations are plain SQL files applied in lexicographic order.

Naming convention:

```text
001_initial_schema.sql
002_add_some_feature.sql
```

Run from `kontigoapp-backend`:

```bash
pnpm run migrate
```

The runner creates `schema_migrations` and skips files already recorded there.
Set `DATABASE_URL` in `.env` or the process environment before running.
