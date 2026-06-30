import type { Database } from "@carbon/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MigrationDryRunReport,
  MigrationExecutionReport,
  MigrationImportRequest
} from "../../../../../database/supabase/functions/import-csv/migration-runner.ts";
import type {
  MigrationRunRequest,
  SourceProfile
} from "../../../../../database/supabase/functions/import-csv/migration-source-profiles.ts";

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
    report: MigrationDryRunReport,
    request: PersistedMigrationRunRequest
  ) => Promise<MigrationExecutionReport>;
};

async function loadMigrationRequestSchema() {
  const module = await import(
    "../../../../../database/supabase/functions/import-csv/migration-source-profiles.ts"
  );
  const resolved =
    (module as any).migrationRunRequestSchema ??
    (module as any).default?.migrationRunRequestSchema ??
    (module as any)["module.exports"]?.migrationRunRequestSchema;

  if (!resolved) {
    throw new Error("migrationRunRequestSchema export not found");
  }

  return resolved as {
    safeParse: (value: unknown) =>
      | { success: true; data: MigrationRunRequest }
      | {
          success: false;
          error: { issues: Array<{ path: PropertyKey[]; message: string }> };
        };
  };
}

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

function invalidRequestReason(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}) {
  const issue = error.issues[0];
  const path = issue?.path.length ? issue.path.join(".") : "request";
  const message = issue?.message ?? "invalid shape";
  return `Invalid migration run request: ${path} ${message}`;
}

function fileNameForRequest(request: { fileName?: string; filePath: string }) {
  if (request.fileName) return request.fileName;
  return request.filePath.split("/").pop() ?? request.filePath;
}

type ResponseBodyReader = {
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
};

function toResponseBodyReader(value: unknown): ResponseBodyReader | null {
  if (!value || typeof value !== "object") return null;

  const json = (value as { json?: unknown }).json;
  const text = (value as { text?: unknown }).text;

  return {
    json:
      typeof json === "function"
        ? () => (json as () => Promise<unknown>).call(value)
        : undefined,
    text:
      typeof text === "function"
        ? () => (text as () => Promise<string>).call(value)
        : undefined
  };
}

async function functionErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return null;

  const context = (error as { context?: unknown }).context;
  if (!context || typeof context !== "object") return null;

  const responseLike =
    typeof (context as { clone?: unknown }).clone === "function"
      ? toResponseBodyReader((context as { clone: () => unknown }).clone())
      : toResponseBodyReader(context);

  if (!responseLike) return null;

  const parsedFromJson = await readBodyMessage(responseLike);
  if (parsedFromJson) return parsedFromJson;

  const parsedFromText = await readTextMessage(responseLike);
  if (parsedFromText) return parsedFromText;

  return null;
}

async function readBodyMessage(response: ResponseBodyReader) {
  if (typeof response.json !== "function") return null;

  try {
    const body = await response.json();
    if (typeof body === "string" && body.trim()) return body.trim();
    if (!body || typeof body !== "object") return null;

    const message = (body as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();

    const error = (body as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error.trim();
  } catch {
    return null;
  }

  return null;
}

async function readTextMessage(response: ResponseBodyReader) {
  if (typeof response.text !== "function") return null;

  try {
    const body = (await response.text()).trim();
    if (!body) return null;

    try {
      const parsed = JSON.parse(body) as { message?: unknown; error?: unknown };
      if (typeof parsed.message === "string" && parsed.message.trim()) {
        return parsed.message.trim();
      }
      if (typeof parsed.error === "string" && parsed.error.trim()) {
        return parsed.error.trim();
      }
    } catch {
      return body;
    }
  } catch {
    return null;
  }

  return null;
}

export async function executePersistedApply(
  client: Pick<SupabaseClient<Database>, "functions">,
  report: MigrationDryRunReport,
  persistedRequest: PersistedMigrationRunRequest
) {
  const migrationRunnerModule = await import(
    "../../../../../database/supabase/functions/import-csv/migration-runner.ts"
  );
  const migrationRunner =
    (migrationRunnerModule as any).default ?? migrationRunnerModule;

  return migrationRunner.executeMigrationPlan(
    report,
    async (request: MigrationImportRequest) => {
      const fileName = fileNameForRequest(request);
      const csvText = persistedRequest.files[fileName];

      if (csvText === undefined) {
        throw new Error(`Missing persisted CSV for ${fileName}`);
      }

      const result = await client.functions.invoke("import-csv", {
        body: {
          ...request,
          csvText
        }
      });

      if (result.error) {
        const surfacedMessage =
          (await functionErrorMessage(result.error)) ?? result.error.message;
        throw new Error(
          `import-csv ${request.table} ${fileName}: ${surfacedMessage}`
        );
      }

      return {
        inserted: result.data?.inserted ?? 0,
        updated: result.data?.updated ?? 0,
        skipped: result.data?.skipped ?? 0,
        errors: result.data?.errors ?? []
      };
    }
  );
}

export async function runMigrationRun(
  payload: MigrationRunPayload,
  deps: MigrationRunDeps
) {
  const run = await deps.loadRun(payload);

  if (payload.action === "dry-run") {
    await deps.updateRun({ status: "running-dry-run", error: null });

    const migrationRunRequestSchema = await loadMigrationRequestSchema();
    const parsedRequest = migrationRunRequestSchema.safeParse(run.request);
    if (!parsedRequest.success) {
      await deps.updateRun({
        status: "failed",
        error: invalidRequestReason(parsedRequest.error)
      });
      return null;
    }

    const report = await buildDryRunReport({
      scenario: parsedRequest.data.scenario,
      profile: parsedRequest.data.profile,
      files: parsedRequest.data.files,
      companyId: payload.companyId,
      userId: payload.userId,
      filePathPrefix: parsedRequest.data.filePathPrefix
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

  const missingFile = run.planSnapshot.importRequests.find((request) => {
    const fileName = fileNameForRequest(request);
    return run.request.files[fileName] === undefined;
  });

  if (missingFile) {
    await deps.updateRun({
      status: "failed",
      error: `Missing persisted CSV for ${fileNameForRequest(missingFile)}`
    });
    return null;
  }

  const execution = await deps.executeApply(run.planSnapshot, run.request);

  await deps.updateRun({
    status: execution.status === "pass" ? "applied" : "failed",
    error: execution.status === "fail" ? firstErrorReason(execution) : null,
    applySummary: summarizeApply(execution)
  });

  return execution;
}
