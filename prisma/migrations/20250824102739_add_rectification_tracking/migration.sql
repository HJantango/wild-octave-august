-- AlterTable
ALTER TABLE "public"."invoices" ADD COLUMN     "needs_rectification" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rectification_contacted_at" TIMESTAMP(3),
ADD COLUMN     "rectification_notes" TEXT,
ADD COLUMN     "rectification_resolved_at" TIMESTAMP(3);
