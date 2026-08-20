-- Migration: add_retail_sales_upload
-- Adds retail_sales_records and retail_sales_upload_logs tables

CREATE TABLE "retail_sales_records" (
    "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
    "upload_batch_id"   VARCHAR(100) NOT NULL,
    "consignee"         VARCHAR(50)  NOT NULL,
    "dealer_code"       VARCHAR(20)  NOT NULL,
    "loc"               VARCHAR(20),
    "part_category_code" VARCHAR(20),
    "part_num"          VARCHAR(100) NOT NULL,
    "root_part_num"     VARCHAR(100),
    "day"               VARCHAR(5),
    "fiscal_year"       INTEGER,
    "month"             VARCHAR(20),
    "month_year"        VARCHAR(20)  NOT NULL,
    "cons_party_code"   VARCHAR(50),
    "cons_party_name"   VARCHAR(200),
    "party_type"        VARCHAR(100),
    "document_num"      VARCHAR(100) NOT NULL,
    "remarks"           VARCHAR(500),
    "net_retail_qty"    DECIMAL(18,4),
    "net_retail_selling" DECIMAL(18,4),
    "discount_amount"   DECIMAL(18,4),
    "net_retail_ddl"    DECIMAL(18,4),
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by"        UUID,
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retail_sales_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "retail_sales_unique_row" UNIQUE ("consignee", "dealer_code", "part_num", "document_num", "month_year")
);

CREATE INDEX "retail_sales_records_dealer_code_month_year_idx"   ON "retail_sales_records"("dealer_code", "month_year");
CREATE INDEX "retail_sales_records_upload_batch_id_idx"          ON "retail_sales_records"("upload_batch_id");
CREATE INDEX "retail_sales_records_month_year_idx"               ON "retail_sales_records"("month_year");
CREATE INDEX "retail_sales_records_consignee_month_year_idx"     ON "retail_sales_records"("consignee", "month_year");

CREATE TABLE "retail_sales_upload_logs" (
    "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
    "batch_id"      VARCHAR(100) NOT NULL,
    "file_name"     VARCHAR(500) NOT NULL,
    "month_year"    VARCHAR(20)  NOT NULL,
    "total_rows"    INTEGER      NOT NULL,
    "inserted_rows" INTEGER      NOT NULL DEFAULT 0,
    "deleted_rows"  INTEGER      NOT NULL DEFAULT 0,
    "status"        VARCHAR(20)  NOT NULL,
    "error_message" TEXT,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by"    UUID,
    "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retail_sales_upload_logs_pkey"    PRIMARY KEY ("id"),
    CONSTRAINT "retail_sales_upload_logs_batch_id_key" UNIQUE ("batch_id")
);

CREATE INDEX "retail_sales_upload_logs_month_year_idx"           ON "retail_sales_upload_logs"("month_year");
CREATE INDEX "retail_sales_upload_logs_created_by_created_at_idx" ON "retail_sales_upload_logs"("created_by", "created_at");
