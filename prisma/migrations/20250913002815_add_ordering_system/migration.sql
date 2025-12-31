-- CreateEnum
CREATE TYPE "public"."ValidationStatus" AS ENUM ('PENDING', 'REVIEWED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."MovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "public"."PurchaseOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'COMPLETED');

-- AlterTable
ALTER TABLE "public"."invoice_line_items" ADD COLUMN     "needs_validation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "original_parsed_data" JSONB,
ADD COLUMN     "validated_at" TIMESTAMP(3),
ADD COLUMN     "validated_by" TEXT,
ADD COLUMN     "validation_flags" JSONB,
ADD COLUMN     "validation_notes" TEXT,
ADD COLUMN     "validation_status" "public"."ValidationStatus";

-- CreateTable
CREATE TABLE "public"."vendor_order_settings" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "orderFrequency" TEXT,
    "minimum_order_value" DECIMAL(10,2),
    "free_shipping_threshold" DECIMAL(10,2),
    "shipping_cost" DECIMAL(8,2),
    "lead_time_days" INTEGER DEFAULT 7,
    "order_day" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_order_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory_items" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "current_stock" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "minimum_stock" DECIMAL(10,4),
    "maximum_stock" DECIMAL(10,4),
    "reorder_point" DECIMAL(10,4),
    "pack_size" INTEGER DEFAULT 1,
    "minimum_order_quantity" DECIMAL(10,4),
    "last_stock_take" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_movements" (
    "id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "movementType" "public"."MovementType" NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "reason" TEXT,
    "reference_id" TEXT,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_orders" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "vendor_order_settings_id" TEXT,
    "order_number" TEXT NOT NULL,
    "status" "public"."PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_delivery_date" TIMESTAMP(3),
    "subtotal_ex_gst" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "gst_amount" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "shipping_cost" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "total_inc_gst" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "sent_at" TIMESTAMP(3),
    "sent_by" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "linked_invoice_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_order_line_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "item_id" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "unit_cost_ex_gst" DECIMAL(10,4) NOT NULL,
    "total_cost_ex_gst" DECIMAL(12,4) NOT NULL,
    "received_quantity" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_suggestions" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "suggested_quantity" DECIMAL(10,4) NOT NULL,
    "reasoning" JSONB NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "period_analyzed" TEXT NOT NULL,
    "sales_velocity" DECIMAL(10,4),
    "days_of_stock" DECIMAL(8,2),
    "seasonal_factor" DECIMAL(5,4),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_order_settings_vendor_id_key" ON "public"."vendor_order_settings"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_item_id_key" ON "public"."inventory_items"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_order_number_key" ON "public"."purchase_orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_linked_invoice_id_key" ON "public"."purchase_orders"("linked_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_suggestions_vendor_id_inventory_item_id_key" ON "public"."order_suggestions"("vendor_id", "inventory_item_id");

-- AddForeignKey
ALTER TABLE "public"."vendor_order_settings" ADD CONSTRAINT "vendor_order_settings_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_items" ADD CONSTRAINT "inventory_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_order_settings_id_fkey" FOREIGN KEY ("vendor_order_settings_id") REFERENCES "public"."vendor_order_settings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_orders" ADD CONSTRAINT "purchase_orders_linked_invoice_id_fkey" FOREIGN KEY ("linked_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_order_line_items" ADD CONSTRAINT "purchase_order_line_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_order_line_items" ADD CONSTRAINT "purchase_order_line_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_suggestions" ADD CONSTRAINT "order_suggestions_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_suggestions" ADD CONSTRAINT "order_suggestions_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
