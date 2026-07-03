# Kapital — Backend API

REST API for Kapital, a currency exchange (casa de cambios) management system. Built with Express + TypeScript, deployed as an Azure Function (Consumption plan).

## Overview

The backend handles two responsibilities:

1. **WhatsApp Bot** — receives webhooks from Evolution API, parses text commands (`#TRANSACCION`, `#TASA`, `#HOY`, `#YO`, `#AYUDA`), runs business logic, and sends WhatsApp confirmations back via Evolution API.
2. **Management API** — authenticated REST endpoints consumed by the frontend dashboard (transactions, dashboard metrics, exports, collaborators, clients, rates).

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20, TypeScript 5 |
| Framework | Express 4 |
| Hosting | Azure Functions v4 (Consumption plan, Brazil South) |
| Database | PostgreSQL via [postgres](https://github.com/porsager/postgres) |
| Auth | Firebase Admin SDK (ID token verification) |
| WhatsApp | [Evolution API](https://github.com/EvolutionAPI/evolution-api) |
| Logging | BetterStack (via `@logtail/node`) + `console.*` fallback |
| Error monitoring | Sentry (optional, via `SENTRY_DSN`) |
| PDF export | PDFKit |
| Excel export | ExcelJS |
| Tests | Vitest |
| CI/CD | GitHub Actions → `az functionapp deployment source config-zip` |

## Project Structure

```
src/
├── functions/          # Azure Functions entry point (azure-bridge)
├── app.ts              # Express app factory — all routes registered here
├── config/
│   ├── env.ts          # Zod-validated environment variables
│   └── firebaseAdmin.ts
├── domain/             # Pure TypeScript types (no runtime logic)
├── handlers/           # HTTP request handlers (thin layer, no business logic)
├── services/           # Business logic
│   ├── parser.service.ts         # Parses WhatsApp text commands via regex
│   ├── transaction.service.ts    # Commission calculations + DB persistence
│   ├── whatsapp.service.ts       # Evolution API client + message builders
│   ├── webhook-normalizer.service.ts  # Normalizes multiple Evolution API payload shapes
│   ├── dashboard.service.ts
│   ├── rate.service.ts
│   └── reports.service.ts        # CSV / Excel / PDF generation
├── repositories/       # All SQL queries — one file per domain entity
├── middleware/
│   ├── auth.ts         # Firebase ID token verification + whitelist check
│   └── webhookAuth.ts  # Optional webhook secret validation
├── utils/
│   ├── idempotency.ts  # Deduplication key generation
│   ├── rateLimit.ts    # Per-chat message rate limit (10 msgs / 60s)
│   ├── formatters.ts
│   └── logger.ts       # Structured logger (BetterStack + console)
└── scripts/
    └── migrate.ts      # Runs SQL migrations in order
migrations/             # Numbered SQL files (001, 002, …)
```

## API Endpoints

### Public

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/webhook/whatsapp` | Evolution API webhook receiver |
| `GET` | `/health` | Liveness check — runs `SELECT 1` |

### Authenticated (Firebase Bearer token required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/me` | Returns decoded token info |
| `GET` | `/transactions` | List transactions with filters |
| `DELETE` | `/transactions/:id` | Soft-delete with audit log |
| `GET` | `/dashboard` | Today + month metrics, collaborator performance, top clients, daily chart |
| `GET` | `/rates/current` | Current USD/PYG exchange rate |
| `GET` | `/clients` | Search clients by name |
| `GET` | `/collaborators` | List collaborators |
| `POST` | `/collaborators` | Create collaborator |
| `PUT` | `/collaborators/:id` | Update collaborator |
| `DELETE` | `/collaborators/:id` | Delete collaborator |
| `GET` | `/export/preview` | Preview rows before export |
| `GET` | `/export` | Download CSV, Excel, or PDF report |
| `GET` | `/export/presets` | List saved export presets |
| `POST` | `/export/presets` | Save export preset |
| `DELETE` | `/export/presets/:id` | Delete export preset |
| `GET` | `/webhook/conversations` | WhatsApp conversation list |
| `GET` | `/webhook/messages` | Paginated inbound message log |
| `GET` | `/webhook/messages/:id` | Message detail + flow event timeline |

## WhatsApp Bot Commands

The bot parses plain text messages from authorized WhatsApp numbers.

| Command | Example | Action |
|---------|---------|--------|
| `#TASA [rate]` | `#TASA 7300` | Updates the current USD/PYG exchange rate |
| `#TRANSACCION Cliente [name]: [amount]$ - [%]` | `#TRANSACCION Cliente Ana: 500$ - 15%` | Records a currency exchange transaction |
| `#TRANSACCION Colaborador [name] Cliente [name]: [amount]$ - [%]` | `#TRANSACCION Colaborador Patty Cliente Juan: 300$ - 13%` | Transaction with collaborator attribution |
| `#HOY` | `#HOY` | Daily summary (transaction count, USD volume, rate) |
| `#YO` | `#YO` | Monthly commission summary for the sender |
| `#AYUDA` | `#AYUDA` | Lists all available commands |

Every inbound message is persisted in `whatsapp_inbound_messages` with a full event timeline in `whatsapp_flow_events`, regardless of outcome.

## Database Schema

8 migrations under `migrations/`. Key tables:

| Table | Purpose |
|-------|---------|
| `transactions` | Currency exchange records with full commission breakdown |
| `collaborators` | Collaborator registry with base commission percentage |
| `clients` | Client registry with transaction count |
| `global_rate` | Current USD/PYG exchange rate |
| `export_presets` | Saved report filter configurations |
| `whatsapp_inbound_messages` | Inbound message log with processing status |
| `whatsapp_flow_events` | Step-by-step processing events per message |
| `transaction_audit_log` | Soft-delete audit trail |

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

## Local Development

**Prerequisites:** Node.js 20+, pnpm, Azure Functions Core Tools, a PostgreSQL database.

```bash
# Install dependencies
pnpm install

# Copy and fill env
cp local.settings.json.example local.settings.json  # add your values

# Run migrations
pnpm migrate

# Start dev server (Azure Functions emulator)
pnpm dev
# API available at http://localhost:7071/api/
```

## Running Tests

```bash
pnpm test          # run once
pnpm test:watch    # watch mode
```

Tests cover: parser service, transaction service, dashboard service, reports service, webhook handler, webhook normalizer, rate limit, auth middleware, and database integration.

## Deployment

CI/CD runs on every push to `main` via GitHub Actions:

1. Install dependencies (`pnpm install`)
2. Run tests (`pnpm test`)
3. Build TypeScript (`pnpm build`)
4. Create deployment zip
5. Deploy via Azure CLI (`az functionapp deployment source config-zip`)

Required GitHub secret: `AZURE_CREDENTIALS` (service principal JSON).

## Export Formats

The `/export` endpoint generates three formats:

- **CSV** — plain comma-separated, UTF-8
- **Excel** — `.xlsx` with three sheets: Transactions (with totals row), Summary, and By Collaborator. Branded with Kapital colors.
- **PDF** — A4 landscape, executive layout with KPI cards, collaborator breakdown table, and paginated transaction detail.

All exports support field selection and filters: date range, collaborator, client, and min/max amount.
