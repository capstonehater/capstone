BEGIN;
LOCK TABLE users IN ACCESS EXCLUSIVE MODE;
CREATE SEQUENCE employee_id_sequence;
ALTER TABLE users ADD COLUMN employee_id TEXT;
WITH numbered AS (
  SELECT id, created_at, ROW_NUMBER() OVER (ORDER BY
    CASE WHEN LOWER(email) = 'admin@stockscout.com' THEN 0
         WHEN role = 'ADMINISTRATOR' THEN 1 ELSE 2 END,
    created_at, id) AS n
  FROM users
)
UPDATE users u SET employee_id = 'EMP-' ||
  TO_CHAR(n.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'YY') || '-' ||
  LPAD(n.n::text, GREATEST(3, LENGTH(n.n::text)), '0')
FROM numbered n WHERE u.id = n.id;
SELECT setval('employee_id_sequence', GREATEST((SELECT COUNT(*) FROM users), 1),
  EXISTS (SELECT 1 FROM users));
CREATE FUNCTION next_employee_id() RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE number BIGINT := nextval('employee_id_sequence');
BEGIN
  RETURN 'EMP-' || TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', 'YY') || '-' ||
    LPAD(number::text, GREATEST(3, LENGTH(number::text)), '0');
END;
$$;
ALTER TABLE users ALTER COLUMN employee_id SET NOT NULL;
ALTER TABLE users ALTER COLUMN employee_id SET DEFAULT next_employee_id();
CREATE UNIQUE INDEX users_employee_id_key ON users(employee_id);
COMMIT;
