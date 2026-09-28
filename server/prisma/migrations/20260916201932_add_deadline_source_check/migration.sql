-- This is an empty migration.-- Enforce: source = ASSIGNMENT requires related_assignment_id;
-- source = CUSTOM forbids it
ALTER TABLE "Deadline"
ADD CONSTRAINT "deadline_source_assignment_check"
CHECK (
  (source = 'ASSIGNMENT' AND related_assignment_id IS NOT NULL)
  OR
  (source = 'CUSTOM' AND related_assignment_id IS NULL)
);