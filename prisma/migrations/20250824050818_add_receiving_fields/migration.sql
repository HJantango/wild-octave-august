-- AlterTable
ALTER TABLE "public"."invoices" ADD COLUMN     "all_items_checked_in" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "all_items_received" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "missing_items" JSONB,
ADD COLUMN     "receiving_notes" TEXT;
