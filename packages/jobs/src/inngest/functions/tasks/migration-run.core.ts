import type {
  MigrationDryRunReport,
  MigrationExecutionReport
} from "../../../../../database/supabase/functions/import-csv/migration-runner.ts";
import type { SourceProfile } from "../../../../../database/supabase/functions/import-csv/migration-source-profiles.ts";

type MigrationRunAction = "dry-run" | "apply";

export type MigrationRunPayload = {
  migrationRunId: string;
  companyId: string;
  userId: string;
  action: MigrationRunAction;
};

export type PersistedMigrationRunRequest = {
  scenario: string;
  profile: SourceProfile;
  files: Record<string, string>;
  filePathPrefix?: string;
};

export type PersistedMigrationRun = {
  id: string;
  request: PersistedMigrationRunRequest;
  planSnapshot: MigrationDryRunReport | null;
};

export type MigrationRunUpdate = {
  status: string;
  error?: string | null;
  planSnapshot?: MigrationDryRunReport | null;
  dryRunSummary?: Record<string, unknown> | null;
  applySummary?: Record<string, unknown> | null;
};

export type MigrationRunDeps = {
  loadRun: (payload: MigrationRunPayload) => Promise<PersistedMigrationRun>;
  updateRun: (update: MigrationRunUpdate) => Promise<void>;
  executeApply: (
    report: MigrationDryRunReport
  ) => Promise<MigrationExecutionReport>;
};

async function buildDryRunReport(args: {
  scenario: string;
  profile: SourceProfile;
  files: Record<string, string>;
  companyId?: string;
  userId?: string;
  filePathPrefix?: string;
}) {
  const migrationRunnerModule = await import(
    "../../../../../database/supabase/functions/import-csv/migration-runner.ts"
  );
  const migrationRunner =
    (migrationRunnerModule as any).default ?? migrationRunnerModule;
  return migrationRunner.buildDryRunReport(args);
}

function summarizeDryRun(report: MigrationDryRunReport) {
  return {
    scenario: report.scenario,
    status: report.status,
    totalRows: report.totalRows,
    tables: report.tables,
    errors: report.errors,
    warnings: report.warnings
  };
}

function summarizeApply(report: MigrationExecutionReport) {
  return {
    scenario: report.scenario,
    status: report.status,
    summary: report.summary,
    executedTables: report.executedTables,
    errors: report.errors
  };
}

function firstErrorReason(
  report: MigrationDryRunReport | MigrationExecutionReport
) {
  return report.errors[0]?.reason ?? "Migration run failed";
}

export async function runMigrationRun(
  payload: MigrationRunPayload,
  deps: MigrationRunDeps
) {
  const run = await deps.loadRun(payload);

  if (payload.action === "dry-run") {
    await deps.updateRun({ status: "running-dry-run", error: null });

    const report = await buildDryRunReport({
      scenario: run.request.scenario,
      profile: run.request.profile,
      files: run.request.files,
      companyId: payload.companyId,
      userId: payload.userId,
      filePathPrefix: run.request.filePathPrefix
    });

    await deps.updateRun({
      status: report.status === "pass" ? "review-ready" : "failed",
      error: report.status === "fail" ? firstErrorReason(report) : null,
      planSnapshot: report,
      dryRunSummary: summarizeDryRun(report)
    });

    return report;
  }

  if (!run.planSnapshot) {
    await deps.updateRun({
      status: "failed",
      error: "Migration run has no stored plan snapshot"
    });
    throw new Error("Migration run has no stored plan snapshot");
  }

  await deps.updateRun({ status: "running-apply", error: null });

  const execution = await deps.executeApply(run.planSnapshot);

  await deps.updateRun({
    status: execution.status === "pass" ? "applied" : "failed",
    error: execution.status === "fail" ? firstErrorReason(execution) : null,
    applySummary: summarizeApply(execution)
  });

  return execution;
}
