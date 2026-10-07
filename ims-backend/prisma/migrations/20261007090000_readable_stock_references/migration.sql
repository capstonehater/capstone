BEGIN;
-- Keep UUID identities and original names; references are permanent display identifiers.
CREATE TABLE stock_run_reference_counters (
  run_date DATE PRIMARY KEY,
  last_number BIGINT NOT NULL
);
ALTER TABLE stock_runs ADD COLUMN reference TEXT;
ALTER TABLE stock_batches ADD COLUMN reference TEXT;
WITH numbered AS (
  SELECT id, (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::date AS run_date,
    ROW_NUMBER() OVER (PARTITION BY (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::date ORDER BY created_at, id) AS n
  FROM stock_runs
)
UPDATE stock_runs r SET reference = 'ST-RUN-' || TO_CHAR(n.run_date, 'YYYYMMDD') || '-' ||
  LPAD(n.n::text, GREATEST(3, LENGTH(n.n::text)), '0') FROM numbered n WHERE r.id = n.id;
INSERT INTO stock_run_reference_counters (run_date, last_number)
SELECT (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::date, COUNT(*) FROM stock_runs GROUP BY 1;
CREATE FUNCTION next_stock_run_reference() RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE day DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date; number BIGINT;
BEGIN
  INSERT INTO stock_run_reference_counters (run_date, last_number) VALUES (day, 1)
  ON CONFLICT (run_date) DO UPDATE SET last_number = stock_run_reference_counters.last_number + 1
  RETURNING last_number INTO number;
  RETURN 'ST-RUN-' || TO_CHAR(day, 'YYYYMMDD') || '-' || LPAD(number::text, GREATEST(3, LENGTH(number::text)), '0');
END;
$$;
ALTER TABLE stock_runs ALTER COLUMN reference SET NOT NULL;
ALTER TABLE stock_runs ALTER COLUMN reference SET DEFAULT next_stock_run_reference();
CREATE UNIQUE INDEX stock_runs_reference_key ON stock_runs(reference);
WITH numbered AS (
  SELECT b.id, r.reference,
    ROW_NUMBER() OVER (PARTITION BY r.id ORDER BY i.created_at, i.id) AS n
  FROM stock_batches b JOIN stock_run_items i ON i.id = b.stock_run_item_id JOIN stock_runs r ON r.id = i.stock_run_id
)
UPDATE stock_batches b SET reference = n.reference || '-B' || LPAD(n.n::text, GREATEST(2, LENGTH(n.n::text)), '0')
FROM numbered n WHERE b.id = n.id;
CREATE UNIQUE INDEX stock_batches_reference_key ON stock_batches(reference);

COMMIT;
