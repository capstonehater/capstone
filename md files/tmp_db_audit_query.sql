BEGIN READ ONLY;
SELECT current_database() AS db_name, current_schema() AS schema_name, version() AS pg_version;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
SELECT enumtypid::regtype::text AS enum_name, enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid = pg_enum.enumtypid JOIN pg_namespace ns ON ns.oid = pg_type.typnamespace WHERE ns.nspname = 'public' ORDER BY enum_name, enumsortorder;
SELECT migration_name, finished_at, applied_steps_count FROM "_prisma_migrations" ORDER BY started_at;
COMMIT;
