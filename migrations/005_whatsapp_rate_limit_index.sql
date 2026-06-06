CREATE INDEX IF NOT EXISTS whatsapp_inbound_messages_chat_started_idx
  ON whatsapp_inbound_messages (chat_id, processing_started_at DESC);
