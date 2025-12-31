-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."InvoiceStatus" ADD VALUE 'DRAFT';
ALTER TYPE "public"."InvoiceStatus" ADD VALUE 'APPROVED';
ALTER TYPE "public"."InvoiceStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "public"."invoice_line_items" ADD COLUMN     "gst_amount" DECIMAL(10,4),
ADD COLUMN     "gst_rate" DECIMAL(5,2),
ADD COLUMN     "has_gst" BOOLEAN NOT NULL DEFAULT false;
