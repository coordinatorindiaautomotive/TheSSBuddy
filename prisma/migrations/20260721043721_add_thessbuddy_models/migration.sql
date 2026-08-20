-- CreateTable
CREATE TABLE "raw_sales" (
    "id" UUID NOT NULL,
    "consignee" VARCHAR(100) NOT NULL,
    "dealer_code" VARCHAR(100) NOT NULL,
    "loc" VARCHAR(50) NOT NULL,
    "part_category_code" VARCHAR(50) NOT NULL,
    "part_num" VARCHAR(100) NOT NULL,
    "root_part_num" VARCHAR(100) NOT NULL,
    "day" INTEGER NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "month" VARCHAR(20) NOT NULL,
    "month_year" VARCHAR(50) NOT NULL,
    "cons_party_code" VARCHAR(100) NOT NULL,
    "cons_party_name" VARCHAR(200) NOT NULL,
    "party_type" VARCHAR(100) NOT NULL,
    "document_num" VARCHAR(100),
    "remarks" TEXT,
    "net_retail_qty" INTEGER NOT NULL,
    "net_retail_selling" DOUBLE PRECISION NOT NULL,
    "discount_amount" DOUBLE PRECISION NOT NULL,
    "net_retail_ddl" DOUBLE PRECISION NOT NULL,
    "batch_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "allocated_to_user" UUID,
    "allocated_to_branch" VARCHAR(20),
    "status" VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
    "warranty_expiry" TIMESTAMP(3),
    "amc_expiry" TIMESTAMP(3),
    "insurance_expiry" TIMESTAMP(3),
    "barcode" VARCHAR(100),
    "qr_code" VARCHAR(255),
    "depreciation_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "disposal_date" TIMESTAMP(3),
    "vendor_name" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_allocations" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "user_id" UUID,
    "branch_code" VARCHAR(20),
    "allocated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returned_at" TIMESTAMP(3),
    "remarks" TEXT,

    CONSTRAINT "asset_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_maintenance" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "asset_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_desk_tickets" (
    "id" UUID NOT NULL,
    "ticket_no" VARCHAR(50) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "priority" VARCHAR(50) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    "created_by" UUID NOT NULL,
    "assigned_to" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_desk_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_comments" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outstanding_balances" (
    "id" UUID NOT NULL,
    "branch_code" VARCHAR(20) NOT NULL,
    "dealer_code" VARCHAR(100) NOT NULL,
    "agent_name" VARCHAR(200) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "billing_date" TIMESTAMP(3) NOT NULL,
    "age_days" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outstanding_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_code_key" ON "assets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "help_desk_tickets_ticket_no_key" ON "help_desk_tickets"("ticket_no");

-- AddForeignKey
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "help_desk_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
