UPDATE transactions
SET colaborador = 'Gabriel Zambrano'
WHERE colaborador IS NULL;

ALTER TABLE transactions
  ALTER COLUMN colaborador SET NOT NULL;
