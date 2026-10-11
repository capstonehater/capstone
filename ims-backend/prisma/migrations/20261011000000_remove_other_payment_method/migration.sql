-- OTHER was generated only by synthetic history. Refuse to relabel real payments.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM order_payments WHERE method::text = 'OTHER'
    AND (reference IS NULL OR reference NOT LIKE 'SYN-PAY-%')) THEN
    RAISE EXCEPTION 'Non-synthetic OTHER payments require explicit classification before migration';
  END IF;
END $$;

-- Keep the original sample classifications for traceability.
CREATE TABLE payment_method_migration_audit (
  payment_id text PRIMARY KEY,
  previous_method text NOT NULL,
  replacement_method text NOT NULL,
  migrated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO payment_method_migration_audit (payment_id, previous_method, replacement_method)
SELECT p.id, 'OTHER', CASE
  WHEN NOT EXISTS (SELECT 1 FROM order_payments q WHERE q.order_id = p.order_id AND q.method::text = 'CASH') THEN 'CASH'
  WHEN NOT EXISTS (SELECT 1 FROM order_payments q WHERE q.order_id = p.order_id AND q.method::text = 'CARD') THEN 'CARD'
  ELSE 'GCASH' END
FROM order_payments p WHERE p.method::text = 'OTHER';

UPDATE order_payments p SET method = a.replacement_method::"PaymentMethod"
FROM payment_method_migration_audit a WHERE a.payment_id = p.id;

ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'GCASH', 'MAYA', 'CARD');
ALTER TABLE order_payments ALTER COLUMN method TYPE "PaymentMethod" USING method::text::"PaymentMethod";
DROP TYPE "PaymentMethod_old";
