DO $$
BEGIN
  -- This historical folder is intentionally a no-op in the repaired chain.
  -- The Product archive columns, indexes, and foreign key are created by the
  -- later corrective migration that is already recorded in the live database.
  NULL;
END $$;
