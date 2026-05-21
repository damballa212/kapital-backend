CREATE TABLE IF NOT EXISTS whatsapp_inbound_messages (
  id SERIAL PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  chat_id TEXT NOT NULL,
  user_name TEXT,
  content TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  parsed_type TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  flow_stage TEXT NOT NULL DEFAULT 'received',
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  error_message TEXT,
  raw_payload JSONB,
  processing_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whatsapp_inbound_messages_received_at_idx
  ON whatsapp_inbound_messages (received_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_inbound_messages_status_idx
  ON whatsapp_inbound_messages (status);

CREATE INDEX IF NOT EXISTS whatsapp_inbound_messages_parsed_type_idx
  ON whatsapp_inbound_messages (parsed_type);

CREATE INDEX IF NOT EXISTS whatsapp_inbound_messages_chat_id_idx
  ON whatsapp_inbound_messages (chat_id);

CREATE TABLE IF NOT EXISTS whatsapp_flow_events (
  id SERIAL PRIMARY KEY,
  message_log_id INTEGER NOT NULL REFERENCES whatsapp_inbound_messages(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whatsapp_flow_events_message_log_id_idx
  ON whatsapp_flow_events (message_log_id, created_at ASC);
