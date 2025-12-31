-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('PARSED', 'REVIEWED', 'POSTED');

-- CreateTable
CREATE TABLE "public"."vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactInfo" JSONB,
    "paymentTerms" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor_id" TEXT,
    "category" TEXT NOT NULL,
    "current_cost_ex_gst" DECIMAL(10,4) NOT NULL,
    "current_markup" DECIMAL(5,4) NOT NULL,
    "current_sell_ex_gst" DECIMAL(10,4) NOT NULL,
    "current_sell_inc_gst" DECIMAL(10,4) NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."item_price_history" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "cost_ex_gst" DECIMAL(10,4) NOT NULL,
    "markup" DECIMAL(5,4) NOT NULL,
    "sell_ex_gst" DECIMAL(10,4) NOT NULL,
    "sell_inc_gst" DECIMAL(10,4) NOT NULL,
    "source_invoice_id" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoices" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "subtotal_ex_gst" DECIMAL(12,4) NOT NULL,
    "gst_amount" DECIMAL(12,4) NOT NULL,
    "total_inc_gst" DECIMAL(12,4) NOT NULL,
    "raw_pdf" BYTEA,
    "parsed_json" JSONB,
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'PARSED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "item_id" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "unit_cost_ex_gst" DECIMAL(10,4) NOT NULL,
    "detected_pack_size" INTEGER,
    "effective_unit_cost_ex_gst" DECIMAL(10,4) NOT NULL,
    "category" TEXT NOT NULL,
    "markup" DECIMAL(5,4) NOT NULL,
    "sell_ex_gst" DECIMAL(10,4) NOT NULL,
    "sell_inc_gst" DECIMAL(10,4) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sales_reports" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "report_period_start" TIMESTAMP(3) NOT NULL,
    "report_period_end" TIMESTAMP(3) NOT NULL,
    "raw_csv" BYTEA,
    "parsed_json" JSONB,
    "hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sales_aggregates" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT,
    "item_name" TEXT,
    "revenue" DECIMAL(12,4) NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "margin" DECIMAL(12,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roster_staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "base_hourly_rate" DECIMAL(8,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roster_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rosters" (
    "id" TEXT NOT NULL,
    "week_start_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rosters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roster_shifts" (
    "id" TEXT NOT NULL,
    "roster_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 30,
    "role" TEXT,
    "is_backup_barista" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roster_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."public_holidays" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'NSW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendors_name_key" ON "public"."vendors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "items_sku_key" ON "public"."items"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "items_barcode_key" ON "public"."items"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "sales_reports_hash_key" ON "public"."sales_reports"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "sales_aggregates_date_category_item_name_key" ON "public"."sales_aggregates"("date", "category", "item_name");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "public"."settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "roster_staff_name_key" ON "public"."roster_staff"("name");

-- CreateIndex
CREATE UNIQUE INDEX "rosters_week_start_date_key" ON "public"."rosters"("week_start_date");

-- CreateIndex
CREATE UNIQUE INDEX "public_holidays_date_state_key" ON "public"."public_holidays"("date", "state");

-- AddForeignKey
ALTER TABLE "public"."items" ADD CONSTRAINT "items_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."item_price_history" ADD CONSTRAINT "item_price_history_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."item_price_history" ADD CONSTRAINT "item_price_history_source_invoice_id_fkey" FOREIGN KEY ("source_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoice_line_items" ADD CONSTRAINT "invoice_line_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."roster_shifts" ADD CONSTRAINT "roster_shifts_roster_id_fkey" FOREIGN KEY ("roster_id") REFERENCES "public"."rosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."roster_shifts" ADD CONSTRAINT "roster_shifts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."roster_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
