DO $$
DECLARE
  seq RECORD;
  max_value BIGINT;
BEGIN
  FOR seq IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      a.attname AS column_name,
      pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) AS sequence_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) IS NOT NULL
  LOOP
    EXECUTE format(
      'SELECT COALESCE(MAX(%I), 0) FROM %I.%I',
      seq.column_name,
      seq.schema_name,
      seq.table_name
    )
    INTO max_value;

    IF max_value > 0 THEN
      PERFORM setval(seq.sequence_name, max_value, true);
    ELSE
      PERFORM setval(seq.sequence_name, 1, false);
    END IF;
  END LOOP;
END $$;
