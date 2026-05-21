CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  tx_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS clients_name_lower_idx
  ON clients (LOWER(name));

CREATE TABLE IF NOT EXISTS collaborators (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  base_pct_usd_total NUMERIC(5,4),
  tx_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS collaborators_name_lower_idx
  ON collaborators (LOWER(name));

CREATE TABLE IF NOT EXISTS global_rate (
  id SERIAL PRIMARY KEY,
  rate NUMERIC(18,6) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  fecha TIMESTAMPTZ NOT NULL,
  chat_id TEXT NOT NULL,
  colaborador TEXT,
  cliente TEXT NOT NULL,
  usd_total NUMERIC(18,6) NOT NULL,
  comision NUMERIC(18,6) NOT NULL,
  usd_neto NUMERIC(18,6) NOT NULL,
  monto_gs NUMERIC(18,2) NOT NULL,
  monto_colaborador_gs NUMERIC(18,2) NOT NULL,
  monto_colaborador_usd NUMERIC(18,6) NOT NULL,
  monto_comision_gabriel_gs NUMERIC(18,2) NOT NULL,
  monto_comision_gabriel_usd NUMERIC(18,6) NOT NULL,
  tasa_usada NUMERIC(18,4) NOT NULL,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_fecha_idx
  ON transactions (fecha DESC);

CREATE INDEX IF NOT EXISTS transactions_colaborador_idx
  ON transactions (LOWER(colaborador));

CREATE INDEX IF NOT EXISTS transactions_cliente_idx
  ON transactions (LOWER(cliente));

CREATE TABLE IF NOT EXISTS export_presets (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaction_audit_log (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL,
  action TEXT NOT NULL DEFAULT 'DELETE',
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot JSONB NOT NULL
);
