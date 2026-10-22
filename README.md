# KapitalApp - Backend API

Backend API for KapitalApp, an internal operating ledger for Gabriel Zambrano's TikTok creator payout/liquidation workflow in Paraguay.

KapitalApp is not a generic currency-exchange CRM. The real operation is narrower: creators receive TikTok gifts, withdraw the money to PayPal, and Gabriel helps liquidate that value through PayPal, Bank of America, Zelle, USDT, and Paraguayan guaranies depending on available liquidity, limits, and agreed commission. Gabriel Zambrano owns the business; collaborators may help register or close operations, but they are operational collaborators and can change over time.

The backend records those operations, calculates commissions and PYG equivalents, keeps an auditable WhatsApp processing trail, and exposes authenticated APIs for the dashboard and accounting exports.

## Business Context

The system supports this operational flow:

1. A TikTok creator agrees a payout/liquidation operation with Gabriel outside the app.
2. The creator withdraws TikTok earnings to PayPal.
3. Gabriel consolidates or moves funds through PayPal, Bank of America, Zelle, or USDT depending on liquidity and limits.
4. Gabriel delivers value to the client in guaranies or USDT.
5. Gabriel or an active collaborator registers the completed or in-progress operation in WhatsApp using `#TRANSACCION`.
6. KapitalApp stores the transaction, commission breakdown, exchange rate, accounting data, and exportable history.

Primary product goal: keep clear operational and accounting records for Gabriel and his accountant. This is a financial control system for internal use, not a public client-facing bot.

## Responsibilities

The backend has two main responsibilities:

1. **WhatsApp operating ledger** - receives Evolution API webhooks, validates/parses operator commands, applies business rules, persists transactions, and sends WhatsApp confirmations.
2. **Management API** - authenticated REST endpoints consumed by the frontend dashboard for transactions, metrics, exports, collaborators, clients, rates, and WhatsApp processing logs.

## Operator Boundaries

- Gabriel Zambrano is the business owner and default operator.
- Collaborators are dynamic operational users stored in `collaborators`; they can be added, edited, deactivated, or removed from the dashboard/API.
- End clients do not normally interact with the bot.
- The webhook is designed to register operations already closed or coordinated outside the system.
- Reports and exports are for operational review and accounting, especially transaction history, commissions, rates used, and guaranies delivered.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+, TypeScript 5 |
| Framework | Express 4 |
| Hosting | Azure Functions v4 (Consumption plan, Brazil South) |
| Database | PostgreSQL via [postgres](https://github.com/porsager/postgres) |
| Auth | Firebase Admin SDK (ID token verification) |
| WhatsApp | [Evolution API](https://github.com/EvolutionAPI/evolution-api) |
| Logging | Better Stack (via `@logtail/node`) + `console.*` fallback |
| Error monitoring | Sentry (`@sentry/node`, enabled via `SENTRY_DSN`) |
| PDF export | PDFKit |
| Excel export | ExcelJS |
| Tests | Vitest |
| CI/CD | GitHub Actions -> `az functionapp deployment source config-zip` |

## Project Structure

```text
src/
├── functions/          # Azure Functions entry point (azure-bridge)
├── app.ts              # Express app factory; all routes registered here
├── config/
│   ├── env.ts          # Zod-validated environment variables
│   └── firebaseAdmin.ts
├── domain/             # Pure TypeScript types
├── handlers/           # HTTP request handlers
├── services/           # Business logic
│   ├── parser.service.ts              # Parses WhatsApp text commands
│   ├── transaction.service.ts         # Commission calculations + DB persistence
│   ├── whatsapp.service.ts            # Evolution API client + message builders
│   ├── webhook-normalizer.service.ts  # Normalizes Evolution API payload shapes
│   ├── dashboard.service.ts
│   ├── rate.service.ts
│   └── reports.service.ts             # CSV / Excel / PDF generation
├── repositories/       # SQL queries by domain entity
├── middleware/
│   ├── auth.ts         # Firebase ID token verification + whitelist check
│   └── webhookAuth.ts  # Optional webhook secret validation
├── utils/
│   ├── idempotency.ts  # Deduplication key generation
│   ├── rateLimit.ts    # Per-chat message rate limit (10 msgs / 60s)
│   ├── formatters.ts
│   └── logger.ts       # Structured logger (Better Stack + console)
└── scripts/
    └── migrate.ts      # Runs SQL migrations in order
migrations/             # Numbered SQL files (001, 002, ...)
```

## API Endpoints

### Public

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/webhook/whatsapp` | Evolution API webhook receiver for operator WhatsApp messages |
| `GET` | `/health` | Liveness check; runs `SELECT 1` against PostgreSQL |

### Authenticated

Firebase Bearer token required. The backend also enforces the `allowed_users` whitelist.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/me` | Returns decoded token info |
| `GET` | `/transactions` | List operations with filters |
| `DELETE` | `/transactions/:id` | Soft-delete with audit log |
| `GET` | `/dashboard` | Today + month metrics, collaborator performance, top clients, daily chart |
| `GET` | `/rates/current` | Current USD/PYG exchange rate |
| `GET` | `/clients` | Search clients by name |
| `GET` | `/collaborators` | List collaborators/operators |
| `POST` | `/collaborators` | Create collaborator |
| `PUT` | `/collaborators/:id` | Update collaborator |
| `DELETE` | `/collaborators/:id` | Delete collaborator |
| `GET` | `/export/preview` | Preview rows before export |
| `GET` | `/export` | Download CSV, Excel, or PDF accounting report |
| `GET` | `/export/presets` | List saved export presets |
| `POST` | `/export/presets` | Save export preset |
| `DELETE` | `/export/presets/:id` | Delete export preset |
| `GET` | `/webhook/conversations` | WhatsApp conversation list |
| `GET` | `/webhook/messages` | Paginated inbound message log |
| `GET` | `/webhook/messages/:id` | Message detail + flow event timeline |

## WhatsApp Commands

The bot parses plain text messages from authorized WhatsApp operators.

| Command | Example | Action |
|---------|---------|--------|
| `#TASA [rate]` | `#TASA 7300` | Updates the current USD/PYG rate used for future operations |
| `#TRANSACCION Cliente [name]: [amount]$ - [%]` | `#TRANSACCION Cliente Ana: 500$ - 15%` | Records a TikTok/PayPal liquidation operation |
| `#TRANSACCION Colaborador [name] Cliente [name]: [amount]$ - [%]` | `#TRANSACCION Colaborador Carlos Cliente Juan: 300$ - 13%` | Records an operation with collaborator attribution |
| `#HOY` | `#HOY` | Daily summary: operation count, USD volume, and active rate |
| `#YO` | `#YO` | Monthly commission summary for the sender |
| `#AYUDA` | `#AYUDA` | Lists available commands and formats |

Every inbound message is persisted in `whatsapp_inbound_messages` with a full event timeline in `whatsapp_flow_events`, regardless of success or failure.

## Business Rules

- Gabriel Zambrano is the default collaborator when a transaction does not specify one.
- Active collaborators are resolved from the `collaborators` table first.
- Existing hardcoded name fallbacks in `transaction.service.ts` exist for backward compatibility with known historical collaborators and aliases.
- New collaborators without a stored base percentage must include an explicit override in the WhatsApp message, for example `Colaborador Carlos(4%) Cliente ...`.
- Collaborator commission rules live in `transaction.service.ts` and `collaborator.service.ts`.
- The active USD/PYG rate is stored in `global_rate` and can be changed through WhatsApp with `#TASA`.
- Transaction idempotency prevents duplicate persistence when Evolution API retries or sends repeated payloads.
- The webhook intentionally returns `200` even for internal processing failures to avoid aggressive provider retries; errors are logged and visible in the WhatsApp monitor.

## Database Schema

Key tables:

| Table | Purpose |
|-------|---------|
| `transactions` | Liquidation operation records with commission and PYG breakdown |
| `collaborators` | Operator/collaborator registry with base commission percentage |
| `clients` | Client registry with transaction count |
| `global_rate` | Current USD/PYG exchange rate |
| `export_presets` | Saved report filter configurations |
| `whatsapp_inbound_messages` | Inbound WhatsApp message log with processing status |
| `whatsapp_flow_events` | Step-by-step processing events per message |
| `transaction_audit_log` | Soft-delete audit trail |
| `allowed_users` | Dashboard access whitelist |

## Environment Variables

```env
# Required
DATABASE_URL=postgresql://...
EVOLUTION_API_URL=https://your-evolution-api-host
EVOLUTION_API_KEY=your-instance-api-key
EVOLUTION_INSTANCE=your-instance-name

# Optional
BETTERSTACK_TOKEN=your-source-token
BETTERSTACK_HOST=https://your-source.betterstackdata.com
SENTRY_DSN=https://your-sentry-dsn
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=kapital-backend@<commit-sha>
ALLOWED_ORIGIN=https://your-frontend-domain
EVOLUTION_WEBHOOK_SECRET=optional-webhook-secret
```

`EVOLUTION_WEBHOOK_SECRET` is optional in code but should be treated as production security configuration.

## Local Development

Prerequisites: Node.js 20+, pnpm, Azure Functions Core Tools, and a PostgreSQL database.

```bash
# Install dependencies
pnpm install

# Copy and fill env
cp local.settings.json.example local.settings.json

# Run migrations
pnpm migrate

# Start dev server (Azure Functions emulator)
pnpm dev
# API available at http://localhost:7071/api/
```

## Running Tests

```bash
pnpm test
pnpm test:watch
```

Tests cover parser logic, transaction calculations, dashboard metrics, report generation, webhook handling, webhook payload normalization, rate limiting, auth middleware, and database integration.

## Deployment

CI/CD runs on every push to `main` via GitHub Actions:

1. Install dependencies with `pnpm install`.
2. Run tests with `pnpm test`.
3. Build TypeScript with `pnpm build`.
4. Upload source maps to Sentry when `SENTRY_AUTH_TOKEN` is configured.
5. Create the deployment zip.
6. Deploy via Azure CLI with `az functionapp deployment source config-zip`.
7. Set runtime Sentry release metadata on the Function App.

Required GitHub secret: `AZURE_CREDENTIALS` (service principal JSON).

Optional GitHub secret: `SENTRY_AUTH_TOKEN` for source map upload to Sentry project `kapital-backend`.

## Export Formats

The `/export` endpoint generates accounting and operational reports:

- **CSV** - plain comma-separated, UTF-8.
- **Excel** - `.xlsx` with Transactions, Summary, and By Collaborator sheets.
- **PDF** - A4 landscape report with KPI cards, collaborator breakdown, and paginated transaction details.

All exports support field selection and filters by date range, collaborator, client, and min/max amount.

## Production Monitoring

- `/health` is monitored by Better Stack.
- Backend errors are sent to Sentry project `kapital-backend` when `SENTRY_DSN` is present.
- Sentry is connected to Linear so new or regressed production errors can create Linear issues automatically.
