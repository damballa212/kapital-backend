-- Índice compuesto para rate limiting por chat_id
CREATE INDEX IF NOT EXISTS transactions_chat_created
  ON transactions (chat_id, created_at DESC);

-- Normalizar global_rate a una sola fila (id=1)
-- Conserva la tasa más reciente, elimina las demás
INSERT INTO global_rate (id, rate, updated_at)
SELECT 1, rate, updated_at
FROM global_rate
ORDER BY updated_at DESC
LIMIT 1
ON CONFLICT (id) DO UPDATE
  SET rate       = EXCLUDED.rate,
      updated_at = EXCLUDED.updated_at;

DELETE FROM global_rate WHERE id != 1;
