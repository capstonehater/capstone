BEGIN;

-- Match draft creation locking while reclaiming unused numbers.
SELECT pg_advisory_xact_lock(hashtext('stock-run-draft-limit'));
LOCK TABLE stock_run_reference_counters IN SHARE ROW EXCLUSIVE MODE;

-- Reclaim trailing numbers consumed by drafts that were already deleted.
-- Use the highest surviving reference, never a row count, so posted IDs stay unique.
UPDATE stock_run_reference_counters c
SET last_number = COALESCE((
  SELECT MAX(SPLIT_PART(r.reference, '-', 4)::BIGINT)
  FROM stock_runs r
  WHERE r.reference ~ '^ST-RUN-[0-9]{8}-[0-9]+$'
    AND SPLIT_PART(r.reference, '-', 3) = TO_CHAR(c.run_date, 'YYYYMMDD')
), 0);

CREATE FUNCTION reclaim_deleted_stock_run_draft_reference() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE reference_day DATE; highest_remaining BIGINT;
BEGIN
  IF OLD.status <> 'DRAFT' OR OLD.reference !~ '^ST-RUN-[0-9]{8}-[0-9]+$' THEN
    RETURN OLD;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('stock-run-draft-limit'));
  reference_day := TO_DATE(SPLIT_PART(OLD.reference, '-', 3), 'YYYYMMDD');
  -- Serialize against the database default that allocates the next number.
  PERFORM 1 FROM stock_run_reference_counters WHERE run_date = reference_day FOR UPDATE;
  SELECT COALESCE(MAX(SPLIT_PART(reference, '-', 4)::BIGINT), 0)
  INTO highest_remaining
  FROM stock_runs
  WHERE reference ~ '^ST-RUN-[0-9]{8}-[0-9]+$'
    AND SPLIT_PART(reference, '-', 3) = TO_CHAR(reference_day, 'YYYYMMDD');
  UPDATE stock_run_reference_counters
  SET last_number = highest_remaining
  WHERE run_date = reference_day;
  RETURN OLD;
END;
$$;

CREATE TRIGGER reclaim_deleted_stock_run_draft_reference
AFTER DELETE ON stock_runs
FOR EACH ROW EXECUTE FUNCTION reclaim_deleted_stock_run_draft_reference();

COMMIT;
