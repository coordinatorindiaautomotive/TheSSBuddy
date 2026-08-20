-- CreateEnum
CREATE TYPE "PeriodModuleType" AS ENUM ('INCENTIVE', 'CASH', 'MONTH');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'LOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('INCENTIVE_SLAB', 'TDS_DEDUCTION', 'OUTSTANDING_AGING');

-- CreateEnum
CREATE TYPE "RuleConditionOperator" AS ENUM ('EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'NOT_IN', 'BETWEEN', 'LIKE', 'IS_NULL', 'IS_NOT_NULL');

-- CreateEnum
CREATE TYPE "RuleActionType" AS ENUM ('SET_VALUE', 'MULTIPLY', 'ADD', 'SUBTRACT', 'APPLY_FORMULA', 'SET_FLAG');

-- CreateEnum
CREATE TYPE "RuleVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowEntityType" AS ENUM ('INCENTIVE_RECORD', 'CASH_RECONCILIATION', 'EXTERNAL_INCENTIVE_UPLOAD', 'GENERAL');

-- CreateEnum
CREATE TYPE "WorkflowStepType" AS ENUM ('APPROVAL', 'NOTIFICATION', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "WorkflowStepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED', 'IN_PROGRESS');

-- CreateEnum
CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('EMAIL', 'SMS', 'IN_APP');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'QUEUED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'ANNOUNCEMENT', 'TASK', 'ALERT');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('STAGING', 'VALIDATED', 'COMMITTED', 'ROLLED_BACK', 'FAILED');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('DEALER', 'CUSTOMER', 'CONSIGNEE');

-- CreateEnum
CREATE TYPE "PartySubType" AS ENUM ('REGULAR', 'PREMIUM', 'TEMPORARY', 'DORMANT');

-- CreateEnum
CREATE TYPE "MappingType" AS ENUM ('EXECUTIVE_ASSIGNMENT', 'BRANCH_ASSOCIATION', 'CODE_ALTERNATE', 'CATEGORY_MAPPING');

-- CreateEnum
CREATE TYPE "CashTransactionType" AS ENUM ('CASH_IN', 'CASH_OUT');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('UNRECONCILED', 'RECONCILED', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "IncentiveRecordType" AS ENUM ('CALCULATED', 'MANUALLY_UPLOADED', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "IncentiveRecordStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'POSTED');

-- CreateEnum
CREATE TYPE "AnnouncementScope" AS ENUM ('ALL', 'BRANCH', 'ROLE', 'USER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "refresh_token" VARCHAR(500),
    "refresh_token_exp" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(150) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "module" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" UUID,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "user_branch_access" (
    "userId" UUID NOT NULL,
    "branchCode" VARCHAR(20) NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" UUID,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_branch_access_pkey" PRIMARY KEY ("userId","branchCode")
);

-- CreateTable
CREATE TABLE "branches" (
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "region" VARCHAR(100),
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "parties" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "type" "PartyType" NOT NULL,
    "sub_type" "PartySubType" NOT NULL DEFAULT 'REGULAR',
    "primary_branch_code" VARCHAR(20),
    "pan" VARCHAR(20),
    "gst_in" VARCHAR(20),
    "contact_person" VARCHAR(200),
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "address" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "pincode" VARCHAR(10),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_mapping" (
    "id" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "mapping_type" "MappingType" NOT NULL,
    "mapped_value" VARCHAR(200) NOT NULL,
    "mapped_label" VARCHAR(300),
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "party_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_bank_details" (
    "id" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "bank_name" VARCHAR(200) NOT NULL,
    "branch_name" VARCHAR(200),
    "account_number" VARCHAR(50) NOT NULL,
    "ifsc_code" VARCHAR(20),
    "account_type" VARCHAR(30),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "party_bank_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_locks" (
    "id" UUID NOT NULL,
    "module_type" "PeriodModuleType" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "branch_code" VARCHAR(20),
    "part_category_code" VARCHAR(50),
    "incentive_source" VARCHAR(50),
    "status" "PeriodStatus" NOT NULL,
    "locked_by" UUID,
    "locked_date" TIMESTAMP(3),
    "posted_by" UUID,
    "posted_date" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "closed_by" UUID,
    "unlock_reason" VARCHAR(200),
    "unlock_remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "period_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_master" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "rule_type" "RuleType" NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "rule_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_condition" (
    "id" UUID NOT NULL,
    "rule_master_id" UUID NOT NULL,
    "version_id" UUID,
    "field_path" VARCHAR(200) NOT NULL,
    "operator" "RuleConditionOperator" NOT NULL,
    "value" TEXT,
    "value2" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "logic_group" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "rule_condition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_version" (
    "id" UUID NOT NULL,
    "rule_master_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "RuleVersionStatus" NOT NULL,
    "action_type" "RuleActionType" NOT NULL,
    "action_value" TEXT,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "rule_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incentive_schemes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "source" VARCHAR(50) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "branch_code" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "incentive_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incentive_scheme_detail" (
    "id" UUID NOT NULL,
    "incentive_scheme_id" UUID NOT NULL,
    "location_type" VARCHAR(50),
    "part_category_code" VARCHAR(50),
    "party_type" "PartyType" NOT NULL,
    "slab_from" DECIMAL(18,2) NOT NULL,
    "slab_to" DECIMAL(18,2),
    "incentive_rate" DECIMAL(10,4) NOT NULL,
    "incentive_type" VARCHAR(30) NOT NULL DEFAULT 'PERCENTAGE',
    "min_amount" DECIMAL(18,2),
    "max_amount" DECIMAL(18,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "incentive_scheme_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incentive_records" (
    "id" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "scheme_id" UUID,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "branch_code" VARCHAR(20) NOT NULL,
    "part_category_code" VARCHAR(50),
    "incentive_source" VARCHAR(50),
    "record_type" "IncentiveRecordType" NOT NULL DEFAULT 'CALCULATED',
    "status" "IncentiveRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "base_amount" DECIMAL(18,2) NOT NULL,
    "incentive_rate" DECIMAL(10,4),
    "calculated_amount" DECIMAL(18,2) NOT NULL,
    "tds_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(18,2) NOT NULL,
    "override_remarks" TEXT,
    "overridden_by_id" UUID,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "incentive_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_targets" (
    "id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "branch_code" VARCHAR(20) NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "part_category_code" VARCHAR(50),
    "target_amount" DECIMAL(18,2) NOT NULL,
    "target_quantity" INTEGER,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "dealer_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_monthly_performance" (
    "id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "branch_code" VARCHAR(20) NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "part_category_code" VARCHAR(50),
    "sales_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sales_quantity" INTEGER NOT NULL DEFAULT 0,
    "return_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "return_quantity" INTEGER NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstanding_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "dealer_monthly_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_transactions" (
    "id" UUID NOT NULL,
    "transaction_type" "CashTransactionType" NOT NULL,
    "branch_code" VARCHAR(20) NOT NULL,
    "party_id" UUID,
    "cost_center" VARCHAR(50),
    "amount" DECIMAL(18,2) NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "reference_no" VARCHAR(100),
    "description" TEXT,
    "reconciliation_status" "ReconciliationStatus" NOT NULL DEFAULT 'UNRECONCILED',
    "reconciled_with_id" UUID,
    "reconciled_at" TIMESTAMP(3),
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "cash_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_staging_record" (
    "id" UUID NOT NULL,
    "source_type" VARCHAR(50) NOT NULL,
    "batch_id" UUID NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "amount" DECIMAL(18,2),
    "transaction_date" TIMESTAMP(3),
    "reference_no" VARCHAR(200),
    "party_code" VARCHAR(50),
    "branch_code" VARCHAR(20),
    "payload" JSONB,
    "validation_errors" JSONB,
    "error_message" TEXT,
    "committed_entity_id" UUID,
    "committed_entity_type" VARCHAR(50),
    "committed_at" TIMESTAMP(3),
    "rolled_back_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "raw_staging_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "entity_type" "WorkflowEntityType" NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "id" UUID NOT NULL,
    "workflow_definition_id" UUID NOT NULL,
    "step_number" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "step_type" "WorkflowStepType" NOT NULL,
    "assignee_type" VARCHAR(50),
    "assignee_value" VARCHAR(200),
    "timeout_hours" INTEGER,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "condition_expression" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_instances" (
    "id" UUID NOT NULL,
    "workflow_definition_id" UUID NOT NULL,
    "entity_type" "WorkflowEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "current_step_number" INTEGER NOT NULL DEFAULT 1,
    "initiated_by" UUID NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_assignments" (
    "id" UUID NOT NULL,
    "workflow_instance_id" UUID NOT NULL,
    "workflow_step_id" UUID NOT NULL,
    "assigned_to" UUID NOT NULL,
    "status" "WorkflowStepStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "acted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "workflow_step_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_history" (
    "id" UUID NOT NULL,
    "workflow_instance_id" UUID NOT NULL,
    "workflow_step_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "acted_by" UUID NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_step_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "subject" VARCHAR(500),
    "body" TEXT NOT NULL,
    "merge_fields" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_logs" (
    "id" UUID NOT NULL,
    "template_id" UUID,
    "channel" "MessageChannel" NOT NULL,
    "recipient_id" UUID,
    "recipient_type" VARCHAR(50),
    "recipient_addr" VARCHAR(500) NOT NULL,
    "subject" VARCHAR(500),
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "provider_ref" VARCHAR(500),
    "sent_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "link" VARCHAR(500),
    "metadata" JSONB,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notification_prefs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notification_prefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "body" TEXT NOT NULL,
    "scope" "AnnouncementScope" NOT NULL DEFAULT 'ALL',
    "branch_code" VARCHAR(20),
    "role_ids" JSONB,
    "user_ids" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_snapshots" (
    "id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "opening_balance" DECIMAL(18,2) NOT NULL,
    "total_debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "closing_balance" DECIMAL(18,2) NOT NULL,
    "lineItems" JSONB,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "ledger_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_aggregates" (
    "id" UUID NOT NULL,
    "metric_key" VARCHAR(200) NOT NULL,
    "branch_code" VARCHAR(20),
    "year" INTEGER,
    "month" INTEGER,
    "dimensions" JSONB,
    "value" DECIMAL(22,4) NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_layouts" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "data_source" VARCHAR(100) NOT NULL,
    "columns" JSONB NOT NULL,
    "filters" JSONB,
    "groupBy" JSONB,
    "orderBy" JSONB,
    "user_id" UUID NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "report_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "source_type" VARCHAR(50) NOT NULL,
    "column_mappings" JSONB NOT NULL,
    "validation_rules" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "import_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_logs" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "source_type" VARCHAR(50) NOT NULL,
    "template_id" UUID,
    "file_name" VARCHAR(500) NOT NULL,
    "total_rows" INTEGER NOT NULL,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "committed_rows" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportStatus" NOT NULL,
    "error_message" TEXT,
    "committed_at" TIMESTAMP(3),
    "rolled_back_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "changed_by" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_text" (
    "id" UUID NOT NULL,
    "section" VARCHAR(100) NOT NULL,
    "key" VARCHAR(200) NOT NULL,
    "title" VARCHAR(300),
    "content" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_text_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_IncentiveRecordToWorkflowInstance" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateTable
CREATE TABLE "_CashTransactionToWorkflowInstance" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "parties_code_key" ON "parties"("code");

-- CreateIndex
CREATE INDEX "parties_primary_branch_code_idx" ON "parties"("primary_branch_code");

-- CreateIndex
CREATE INDEX "parties_type_sub_type_idx" ON "parties"("type", "sub_type");

-- CreateIndex
CREATE INDEX "parties_code_primary_branch_code_idx" ON "parties"("code", "primary_branch_code");

-- CreateIndex
CREATE INDEX "party_mapping_partyId_mapping_type_idx" ON "party_mapping"("partyId", "mapping_type");

-- CreateIndex
CREATE INDEX "party_mapping_mapping_type_mapped_value_idx" ON "party_mapping"("mapping_type", "mapped_value");

-- CreateIndex
CREATE INDEX "party_bank_details_partyId_idx" ON "party_bank_details"("partyId");

-- CreateIndex
CREATE INDEX "period_locks_module_type_year_month_idx" ON "period_locks"("module_type", "year", "month");

-- CreateIndex
CREATE INDEX "period_locks_branch_code_year_month_idx" ON "period_locks"("branch_code", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "period_locks_module_type_year_month_branch_code_part_catego_key" ON "period_locks"("module_type", "year", "month", "branch_code", "part_category_code", "incentive_source");

-- CreateIndex
CREATE UNIQUE INDEX "rule_master_code_key" ON "rule_master"("code");

-- CreateIndex
CREATE INDEX "rule_master_rule_type_idx" ON "rule_master"("rule_type");

-- CreateIndex
CREATE INDEX "rule_condition_rule_master_id_idx" ON "rule_condition"("rule_master_id");

-- CreateIndex
CREATE INDEX "rule_condition_version_id_idx" ON "rule_condition"("version_id");

-- CreateIndex
CREATE INDEX "rule_version_rule_master_id_status_idx" ON "rule_version"("rule_master_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rule_version_rule_master_id_version_key" ON "rule_version"("rule_master_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "incentive_schemes_code_key" ON "incentive_schemes"("code");

-- CreateIndex
CREATE INDEX "incentive_schemes_branch_code_is_active_idx" ON "incentive_schemes"("branch_code", "is_active");

-- CreateIndex
CREATE INDEX "incentive_scheme_detail_incentive_scheme_id_idx" ON "incentive_scheme_detail"("incentive_scheme_id");

-- CreateIndex
CREATE INDEX "incentive_scheme_detail_party_type_part_category_code_idx" ON "incentive_scheme_detail"("party_type", "part_category_code");

-- CreateIndex
CREATE INDEX "incentive_records_partyId_year_month_idx" ON "incentive_records"("partyId", "year", "month");

-- CreateIndex
CREATE INDEX "incentive_records_branch_code_year_month_idx" ON "incentive_records"("branch_code", "year", "month");

-- CreateIndex
CREATE INDEX "incentive_records_scheme_id_year_month_idx" ON "incentive_records"("scheme_id", "year", "month");

-- CreateIndex
CREATE INDEX "incentive_records_status_year_month_idx" ON "incentive_records"("status", "year", "month");

-- CreateIndex
CREATE INDEX "dealer_targets_branch_code_year_month_idx" ON "dealer_targets"("branch_code", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_targets_party_id_branch_code_year_month_part_categor_key" ON "dealer_targets"("party_id", "branch_code", "year", "month", "part_category_code");

-- CreateIndex
CREATE INDEX "dealer_monthly_performance_branch_code_year_month_idx" ON "dealer_monthly_performance"("branch_code", "year", "month");

-- CreateIndex
CREATE INDEX "dealer_monthly_performance_year_month_idx" ON "dealer_monthly_performance"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_monthly_performance_party_id_branch_code_year_month__key" ON "dealer_monthly_performance"("party_id", "branch_code", "year", "month", "part_category_code");

-- CreateIndex
CREATE INDEX "cash_transactions_branch_code_transaction_date_idx" ON "cash_transactions"("branch_code", "transaction_date");

-- CreateIndex
CREATE INDEX "cash_transactions_party_id_transaction_date_idx" ON "cash_transactions"("party_id", "transaction_date");

-- CreateIndex
CREATE INDEX "cash_transactions_reconciliation_status_idx" ON "cash_transactions"("reconciliation_status");

-- CreateIndex
CREATE INDEX "cash_transactions_cost_center_transaction_date_idx" ON "cash_transactions"("cost_center", "transaction_date");

-- CreateIndex
CREATE INDEX "raw_staging_record_source_type_batch_id_idx" ON "raw_staging_record"("source_type", "batch_id");

-- CreateIndex
CREATE INDEX "raw_staging_record_source_type_status_idx" ON "raw_staging_record"("source_type", "status");

-- CreateIndex
CREATE INDEX "raw_staging_record_reference_no_idx" ON "raw_staging_record"("reference_no");

-- CreateIndex
CREATE INDEX "raw_staging_record_party_code_idx" ON "raw_staging_record"("party_code");

-- CreateIndex
CREATE INDEX "raw_staging_record_branch_code_transaction_date_idx" ON "raw_staging_record"("branch_code", "transaction_date");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_definitions_code_key" ON "workflow_definitions"("code");

-- CreateIndex
CREATE INDEX "workflow_definitions_entity_type_is_active_idx" ON "workflow_definitions"("entity_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_steps_workflow_definition_id_step_number_key" ON "workflow_steps"("workflow_definition_id", "step_number");

-- CreateIndex
CREATE INDEX "workflow_instances_entity_type_entity_id_idx" ON "workflow_instances"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "workflow_instances_status_idx" ON "workflow_instances"("status");

-- CreateIndex
CREATE INDEX "workflow_instances_initiated_by_idx" ON "workflow_instances"("initiated_by");

-- CreateIndex
CREATE INDEX "workflow_step_assignments_workflow_instance_id_status_idx" ON "workflow_step_assignments"("workflow_instance_id", "status");

-- CreateIndex
CREATE INDEX "workflow_step_assignments_assigned_to_status_idx" ON "workflow_step_assignments"("assigned_to", "status");

-- CreateIndex
CREATE INDEX "workflow_step_history_workflow_instance_id_idx" ON "workflow_step_history"("workflow_instance_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_code_key" ON "message_templates"("code");

-- CreateIndex
CREATE INDEX "message_templates_channel_is_active_idx" ON "message_templates"("channel", "is_active");

-- CreateIndex
CREATE INDEX "message_logs_template_id_idx" ON "message_logs"("template_id");

-- CreateIndex
CREATE INDEX "message_logs_channel_status_idx" ON "message_logs"("channel", "status");

-- CreateIndex
CREATE INDEX "message_logs_recipient_id_idx" ON "message_logs"("recipient_id");

-- CreateIndex
CREATE INDEX "message_logs_created_at_idx" ON "message_logs"("created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_status_idx" ON "notifications"("user_id", "status");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_prefs_user_id_channel_key" ON "user_notification_prefs"("user_id", "channel");

-- CreateIndex
CREATE INDEX "announcements_scope_is_active_idx" ON "announcements"("scope", "is_active");

-- CreateIndex
CREATE INDEX "announcements_branch_code_idx" ON "announcements"("branch_code");

-- CreateIndex
CREATE INDEX "ledger_snapshots_party_id_idx" ON "ledger_snapshots"("party_id");

-- CreateIndex
CREATE INDEX "ledger_snapshots_year_month_idx" ON "ledger_snapshots"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_snapshots_party_id_year_month_key" ON "ledger_snapshots"("party_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_aggregates_metric_key_key" ON "dashboard_aggregates"("metric_key");

-- CreateIndex
CREATE INDEX "dashboard_aggregates_branch_code_year_month_idx" ON "dashboard_aggregates"("branch_code", "year", "month");

-- CreateIndex
CREATE INDEX "dashboard_aggregates_metric_key_idx" ON "dashboard_aggregates"("metric_key");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_aggregates_metric_key_branch_code_year_month_key" ON "dashboard_aggregates"("metric_key", "branch_code", "year", "month");

-- CreateIndex
CREATE INDEX "report_layouts_user_id_idx" ON "report_layouts"("user_id");

-- CreateIndex
CREATE INDEX "report_layouts_data_source_idx" ON "report_layouts"("data_source");

-- CreateIndex
CREATE INDEX "import_templates_source_type_idx" ON "import_templates"("source_type");

-- CreateIndex
CREATE UNIQUE INDEX "import_logs_batch_id_key" ON "import_logs"("batch_id");

-- CreateIndex
CREATE INDEX "import_logs_source_type_status_idx" ON "import_logs"("source_type", "status");

-- CreateIndex
CREATE INDEX "import_logs_created_by_created_at_idx" ON "import_logs"("created_by", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_changed_by_idx" ON "audit_log"("changed_by");

-- CreateIndex
CREATE INDEX "audit_log_changed_at_idx" ON "audit_log"("changed_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_changed_at_idx" ON "audit_log"("entity_type", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "help_text_section_key_key" ON "help_text"("section", "key");

-- CreateIndex
CREATE UNIQUE INDEX "_IncentiveRecordToWorkflowInstance_AB_unique" ON "_IncentiveRecordToWorkflowInstance"("A", "B");

-- CreateIndex
CREATE INDEX "_IncentiveRecordToWorkflowInstance_B_index" ON "_IncentiveRecordToWorkflowInstance"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CashTransactionToWorkflowInstance_AB_unique" ON "_CashTransactionToWorkflowInstance"("A", "B");

-- CreateIndex
CREATE INDEX "_CashTransactionToWorkflowInstance_B_index" ON "_CashTransactionToWorkflowInstance"("B");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branch_access" ADD CONSTRAINT "user_branch_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branch_access" ADD CONSTRAINT "user_branch_access_branchCode_fkey" FOREIGN KEY ("branchCode") REFERENCES "branches"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_primary_branch_code_fkey" FOREIGN KEY ("primary_branch_code") REFERENCES "branches"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_mapping" ADD CONSTRAINT "party_mapping_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_bank_details" ADD CONSTRAINT "party_bank_details_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_locks" ADD CONSTRAINT "period_locks_branch_code_fkey" FOREIGN KEY ("branch_code") REFERENCES "branches"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_locks" ADD CONSTRAINT "period_locks_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_condition" ADD CONSTRAINT "rule_condition_rule_master_id_fkey" FOREIGN KEY ("rule_master_id") REFERENCES "rule_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_condition" ADD CONSTRAINT "rule_condition_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "rule_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_version" ADD CONSTRAINT "rule_version_rule_master_id_fkey" FOREIGN KEY ("rule_master_id") REFERENCES "rule_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_schemes" ADD CONSTRAINT "incentive_schemes_branch_code_fkey" FOREIGN KEY ("branch_code") REFERENCES "branches"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_scheme_detail" ADD CONSTRAINT "incentive_scheme_detail_incentive_scheme_id_fkey" FOREIGN KEY ("incentive_scheme_id") REFERENCES "incentive_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_records" ADD CONSTRAINT "incentive_records_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_records" ADD CONSTRAINT "incentive_records_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "incentive_schemes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_records" ADD CONSTRAINT "incentive_records_branch_code_fkey" FOREIGN KEY ("branch_code") REFERENCES "branches"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentive_records" ADD CONSTRAINT "incentive_records_overridden_by_id_fkey" FOREIGN KEY ("overridden_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_targets" ADD CONSTRAINT "dealer_targets_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_targets" ADD CONSTRAINT "dealer_targets_branch_code_fkey" FOREIGN KEY ("branch_code") REFERENCES "branches"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_monthly_performance" ADD CONSTRAINT "dealer_monthly_performance_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_monthly_performance" ADD CONSTRAINT "dealer_monthly_performance_branch_code_fkey" FOREIGN KEY ("branch_code") REFERENCES "branches"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_branch_code_fkey" FOREIGN KEY ("branch_code") REFERENCES "branches"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_reconciled_with_id_fkey" FOREIGN KEY ("reconciled_with_id") REFERENCES "raw_staging_record"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_staging_record" ADD CONSTRAINT "raw_staging_record_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "import_logs"("batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_definition_id_fkey" FOREIGN KEY ("workflow_definition_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_workflow_definition_id_fkey" FOREIGN KEY ("workflow_definition_id") REFERENCES "workflow_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_assignments" ADD CONSTRAINT "workflow_step_assignments_workflow_instance_id_fkey" FOREIGN KEY ("workflow_instance_id") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_assignments" ADD CONSTRAINT "workflow_step_assignments_workflow_step_id_fkey" FOREIGN KEY ("workflow_step_id") REFERENCES "workflow_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_assignments" ADD CONSTRAINT "workflow_step_assignments_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_history" ADD CONSTRAINT "workflow_step_history_workflow_instance_id_fkey" FOREIGN KEY ("workflow_instance_id") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_history" ADD CONSTRAINT "workflow_step_history_workflow_step_id_fkey" FOREIGN KEY ("workflow_step_id") REFERENCES "workflow_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification_prefs" ADD CONSTRAINT "user_notification_prefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_branch_code_fkey" FOREIGN KEY ("branch_code") REFERENCES "branches"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_snapshots" ADD CONSTRAINT "ledger_snapshots_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_logs" ADD CONSTRAINT "import_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "import_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IncentiveRecordToWorkflowInstance" ADD CONSTRAINT "_IncentiveRecordToWorkflowInstance_A_fkey" FOREIGN KEY ("A") REFERENCES "incentive_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IncentiveRecordToWorkflowInstance" ADD CONSTRAINT "_IncentiveRecordToWorkflowInstance_B_fkey" FOREIGN KEY ("B") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CashTransactionToWorkflowInstance" ADD CONSTRAINT "_CashTransactionToWorkflowInstance_A_fkey" FOREIGN KEY ("A") REFERENCES "cash_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CashTransactionToWorkflowInstance" ADD CONSTRAINT "_CashTransactionToWorkflowInstance_B_fkey" FOREIGN KEY ("B") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
