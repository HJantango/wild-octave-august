-- Add assignees, order_type, contact_method, and trigger to vendor_order_schedules
ALTER TABLE "vendor_order_schedules" ADD COLUMN IF NOT EXISTS "assignees" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "vendor_order_schedules" ADD COLUMN IF NOT EXISTS "order_type" TEXT NOT NULL DEFAULT 'regular';
ALTER TABLE "vendor_order_schedules" ADD COLUMN IF NOT EXISTS "contact_method" TEXT;
ALTER TABLE "vendor_order_schedules" ADD COLUMN IF NOT EXISTS "trigger" TEXT;
