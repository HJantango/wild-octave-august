-- Wild Octave Checklist System Setup
-- Run this in Railway Database Console

-- Drop old tables if they exist (wrong names)
DROP TABLE IF EXISTS "ChecklistCompletion" CASCADE;
DROP TABLE IF EXISTS "ChecklistItem" CASCADE;
DROP TABLE IF EXISTS "ChecklistTemplate" CASCADE;

-- Create tables with correct snake_case names
CREATE TABLE IF NOT EXISTS "checklist_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "section" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "checklist_items" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "specific_days" TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "checklist_completions" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "completed_by" TEXT,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "checklist_completions_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "checklist_templates_section_idx" ON "checklist_templates"("section");
CREATE INDEX IF NOT EXISTS "checklist_templates_is_active_idx" ON "checklist_templates"("is_active");
CREATE INDEX IF NOT EXISTS "checklist_items_template_id_idx" ON "checklist_items"("template_id");
CREATE INDEX IF NOT EXISTS "checklist_items_frequency_idx" ON "checklist_items"("frequency");
CREATE INDEX IF NOT EXISTS "checklist_items_sort_order_idx" ON "checklist_items"("sort_order");
CREATE INDEX IF NOT EXISTS "checklist_completions_item_id_idx" ON "checklist_completions"("item_id");
CREATE INDEX IF NOT EXISTS "checklist_completions_date_idx" ON "checklist_completions"("date");
CREATE UNIQUE INDEX IF NOT EXISTS "checklist_completions_item_id_date_key" ON "checklist_completions"("item_id", "date");

-- Add foreign keys
ALTER TABLE "checklist_items" 
DROP CONSTRAINT IF EXISTS "checklist_items_template_id_fkey";

ALTER TABLE "checklist_items" 
ADD CONSTRAINT "checklist_items_template_id_fkey" 
FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checklist_completions" 
DROP CONSTRAINT IF EXISTS "checklist_completions_item_id_fkey";

ALTER TABLE "checklist_completions" 
ADD CONSTRAINT "checklist_completions_item_id_fkey" 
FOREIGN KEY ("item_id") REFERENCES "checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed data
-- Kitchen template
INSERT INTO "checklist_templates" ("id", "name", "description", "section")
VALUES ('kitchen_template_001', 'Kitchen & Back Tasks', 'Daily kitchen cleaning and maintenance tasks', 'kitchen')
ON CONFLICT ("id") DO NOTHING;

-- Kitchen items
INSERT INTO "checklist_items" ("id", "template_id", "title", "sort_order") VALUES
('kitchen_001', 'kitchen_template_001', 'Wipe down all prep surfaces', 1),
('kitchen_002', 'kitchen_template_001', 'Clean coffee machine', 2),
('kitchen_003', 'kitchen_template_001', 'Empty dishwasher', 3),
('kitchen_004', 'kitchen_template_001', 'Sweep and mop kitchen floor', 4),
('kitchen_005', 'kitchen_template_001', 'Clean sinks', 5),
('kitchen_006', 'kitchen_template_001', 'Wipe down fridges (exterior)', 6),
('kitchen_007', 'kitchen_template_001', 'Clean microwave (inside/outside)', 7),
('kitchen_008', 'kitchen_template_001', 'Take out rubbish', 8),
('kitchen_009', 'kitchen_template_001', 'Stack dishwasher', 9),
('kitchen_010', 'kitchen_template_001', 'Wash pots and pans', 10),
('kitchen_011', 'kitchen_template_001', 'Clean bench scales', 11),
('kitchen_012', 'kitchen_template_001', 'Organize dry storage area', 12),
('kitchen_013', 'kitchen_template_001', 'Check and refill soap dispensers', 13),
('kitchen_014', 'kitchen_template_001', 'Wipe down light switches and door handles', 14)
ON CONFLICT ("id") DO NOTHING;

-- Front template
INSERT INTO "checklist_templates" ("id", "name", "description", "section")
VALUES ('front_template_001', 'Front of House Tasks', 'Customer-facing area maintenance and presentation', 'front')
ON CONFLICT ("id") DO NOTHING;

-- Front items
INSERT INTO "checklist_items" ("id", "template_id", "title", "sort_order") VALUES
('front_001', 'front_template_001', 'Wipe down all tables and chairs', 1),
('front_002', 'front_template_001', 'Vacuum or sweep floors', 2),
('front_003', 'front_template_001', 'Clean windows (inside)', 3),
('front_004', 'front_template_001', 'Dust shelves and displays', 4),
('front_005', 'front_template_001', 'Organize product displays', 5),
('front_006', 'front_template_001', 'Clean entrance door and handles', 6),
('front_007', 'front_template_001', 'Empty customer bins', 7),
('front_008', 'front_template_001', 'Clean and organize counter area', 8),
('front_009', 'front_template_001', 'Wipe down payment terminal', 9),
('front_010', 'front_template_001', 'Check and straighten signage', 10),
('front_011', 'front_template_001', 'Clean light switches and power points', 11),
('front_012', 'front_template_001', 'Organize takeaway supplies', 12),
('front_013', 'front_template_001', 'Clean mirrors (if any)', 13),
('front_014', 'front_template_001', 'Straighten magazines/reading material', 14),
('front_015', 'front_template_001', 'Water plants (if any)', 15),
('front_016', 'front_template_001', 'Clean menu boards', 16),
('front_017', 'front_template_001', 'Organize brochures/flyers', 17),
('front_018', 'front_template_001', 'Check customer seating for damage', 18),
('front_019', 'front_template_001', 'Clean phone/communication devices', 19),
('front_020', 'front_template_001', 'Spot clean walls and surfaces', 20),
('front_021', 'front_template_001', 'Check and replace paper towels', 21),
('front_022', 'front_template_001', 'Clean customer-facing fridge doors', 22),
('front_023', 'front_template_001', 'Organize and clean weighing scales', 23),
('front_024', 'front_template_001', 'Check lighting and replace bulbs', 24),
('front_025', 'front_template_001', 'Clean and organize entrance area', 25)
ON CONFLICT ("id") DO NOTHING;

-- Barista template
INSERT INTO "checklist_templates" ("id", "name", "description", "section")
VALUES ('barista_template_001', 'Barista Tasks', 'Coffee service and barista station maintenance', 'barista')
ON CONFLICT ("id") DO NOTHING;

-- Barista items
INSERT INTO "checklist_items" ("id", "template_id", "title", "sort_order") VALUES
('barista_001', 'barista_template_001', 'Clean espresso machine', 1),
('barista_002', 'barista_template_001', 'Clean and calibrate grinder', 2),
('barista_003', 'barista_template_001', 'Organize coffee station', 3),
('barista_004', 'barista_template_001', 'Clean milk steaming equipment', 4),
('barista_005', 'barista_template_001', 'Check coffee bean supply', 5),
('barista_006', 'barista_template_001', 'Clean cup and saucer storage', 6),
('barista_007', 'barista_template_001', 'Wipe down barista station surfaces', 7)
ON CONFLICT ("id") DO NOTHING;

-- Verify setup
SELECT 'Setup complete! Tables created:' as status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'checklist%';
SELECT 'Total templates:' as info, count(*) as count FROM checklist_templates;
SELECT 'Total items:' as info, count(*) as count FROM checklist_items;