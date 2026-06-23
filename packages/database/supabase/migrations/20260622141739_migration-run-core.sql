CREATE TABLE "migrationRun" (
  "id" TEXT NOT NULL DEFAULT id('mr'),
  "companyId" TEXT NOT NULL REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'queued-dry-run'
    CHECK ("status" IN (
      'queued-dry-run',
      'running-dry-run',
      'review-ready',
      'queued-apply',
      'running-apply',
      'applied',
      'failed'
    )),
  "request" JSONB NOT NULL,
  "planSnapshot" JSONB,
  "dryRunSummary" JSONB,
  "applySummary" JSONB,
  "error" TEXT,
  "createdBy" TEXT NOT NULL REFERENCES "user"("id"),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedBy" TEXT REFERENCES "user"("id"),
  "updatedAt" TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY ("id", "companyId")
);

CREATE INDEX "migrationRun_companyId_idx" ON "migrationRun" ("companyId");
CREATE INDEX "migrationRun_status_idx" ON "migrationRun" ("companyId", "status");
CREATE INDEX "migrationRun_createdAt_idx" ON "migrationRun" ("companyId", "createdAt" DESC);

ALTER TABLE "public"."migrationRun" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SELECT" ON "public"."migrationRun"
  FOR SELECT USING (
    "companyId" = ANY (
      (SELECT get_companies_with_employee_permission('settings_view'))::text[]
    )
  );

CREATE POLICY "INSERT" ON "public"."migrationRun"
  FOR INSERT WITH CHECK (
    "companyId" = ANY (
      (SELECT get_companies_with_employee_permission('settings_update'))::text[]
    )
  );

CREATE POLICY "UPDATE" ON "public"."migrationRun"
  FOR UPDATE USING (
    "companyId" = ANY (
      (SELECT get_companies_with_employee_permission('settings_update'))::text[]
    )
  );

CREATE POLICY "DELETE" ON "public"."migrationRun"
  FOR DELETE USING (
    "companyId" = ANY (
      (SELECT get_companies_with_employee_permission('settings_update'))::text[]
    )
  );
