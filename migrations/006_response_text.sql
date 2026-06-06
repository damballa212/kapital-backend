-- Guarda el texto que el bot intentó enviar de vuelta por WhatsApp
ALTER TABLE whatsapp_inbound_messages
  ADD COLUMN IF NOT EXISTS response_text TEXT;
