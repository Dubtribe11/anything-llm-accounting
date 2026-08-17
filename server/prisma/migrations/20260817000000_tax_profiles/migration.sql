-- CreateTable
CREATE TABLE "tax_profiles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspace_id" INTEGER NOT NULL,
    "entity_type" TEXT NOT NULL DEFAULT 'individual',
    "entity_name" TEXT,
    "abn" TEXT,
    "acn" TEXT,
    "financial_year" TEXT,
    "state" TEXT,
    "residency_status" TEXT,
    "gst_registered" BOOLEAN NOT NULL DEFAULT false,
    "gst_reporting_cycle" TEXT,
    "accounting_basis" TEXT,
    "has_employees" BOOLEAN NOT NULL DEFAULT false,
    "industry" TEXT,
    "accounting_software" TEXT,
    "notes" TEXT,
    "apply_system_prompt" BOOLEAN NOT NULL DEFAULT true,
    "include_rate_digest" BOOLEAN NOT NULL DEFAULT true,
    "knowledge_seeded_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tax_profiles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_profiles_workspace_id_key" ON "tax_profiles"("workspace_id");

-- CreateIndex
CREATE INDEX "tax_profiles_entity_type_idx" ON "tax_profiles"("entity_type");
