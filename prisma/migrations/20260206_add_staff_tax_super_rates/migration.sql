-- Add tax and super rate fields to roster_staff
-- Run this migration against your database when ready

-- Add tax_rate column with default of 30 (30%)
ALTER TABLE "roster_staff" ADD COLUMN "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 30;

-- Add super_rate column (nullable - null means no super, e.g., for juniors)
ALTER TABLE "roster_staff" ADD COLUMN "super_rate" DECIMAL(5,2);

-- Set default super rate of 11.5% for existing non-junior staff
UPDATE "roster_staff" SET "super_rate" = 11.5 WHERE LOWER("role") NOT LIKE '%junior%';

-- Juniors default to NULL (no super)
-- This is already handled by the column being nullable
