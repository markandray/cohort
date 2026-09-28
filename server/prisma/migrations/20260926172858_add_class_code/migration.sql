-- Add class_code as nullable first (existing rows need backfilling before it can be required + unique)
ALTER TABLE "Class" ADD COLUMN "class_code" TEXT;

-- Backfill existing classes one row at a time, generating and checking each code
-- individually (a correlated per-row subquery avoids Postgres treating an
-- uncorrelated random() subquery as a single InitPlan reused for every row).
DO $$
DECLARE
  r RECORD;
  new_code TEXT;
BEGIN
  FOR r IN SELECT id FROM "Class" WHERE class_code IS NULL LOOP
    LOOP
      SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), '')
      INTO new_code
      FROM generate_series(1, 6);

      EXIT WHEN NOT EXISTS (SELECT 1 FROM "Class" WHERE class_code = new_code);
    END LOOP;

    UPDATE "Class" SET class_code = new_code WHERE id = r.id;
  END LOOP;
END $$;

-- Now that every row has a unique value, enforce NOT NULL and uniqueness
ALTER TABLE "Class" ALTER COLUMN "class_code" SET NOT NULL;
CREATE UNIQUE INDEX "Class_class_code_key" ON "Class"("class_code");
