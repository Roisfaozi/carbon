import { getCarbonServiceRole } from "@carbon/auth/client.server";
import type { Database } from "@carbon/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MigrationDryRunReport,
  MigrationImportRequest
} from "../../../../../database/supabase/functions/import-csv/migration-runner.ts";
import { inngest } from "../../client";
import type {
  MigrationRunPayload,
  MigrationRunUpdate,
  PersistedMigrationRun,
  PersistedMigrationRunRequest
} from "./migration-run.core";
import { runMigrationRun } from "./migration-run.core";

export type {
  MigrationRunPayload,
  MigrationRunUpdate,
  PersistedMigrationRun,
  PersistedMigrationRunRequest
} from "./migration-run.core";
export { runMigrationRun } from "./migration-run.core";

async function loadMigrationRun(
  client: SupabaseClient<Database>,
  payload: MigrationRunPayload
): Promise<PersistedMigrationRun> {
  const db = client as any;
  const { data, error } = await db
    .from("migrationRun")
    .select("id, request, planSnapshot")
    .eq("id", payload.migrationRunId)
    .eq("companyId", payload.companyId)
    .single();

  if (error || !data) {
    throw new Error(`Migration run not found: ${payload.migrationRunId}`);
  }

  return {
    id: data.id,
    request: data.request as PersistedMigrationRunRequest,
    planSnapshot: (data.planSnapshot as MigrationDryRunReport | null) ?? null
  };
}

async function updateMigrationRun(
  client: SupabaseClient<Database>,
  payload: MigrationRunPayload,
  update: MigrationRunUpdate
) {
  const db = client as any;
  const { error } = await db
    .from("migrationRun")
    .update({
      status: update.status,
      error: update.error,
      planSnapshot: update.planSnapshot,
      dryRunSummary: update.dryRunSummary,
      applySummary: update.applySummary,
      updatedBy: payload.userId,
      updatedAt: new Date().toISOString()
    })
    .eq("id", payload.migrationRunId)
    .eq("companyId", payload.companyId);

  if (error) {
    throw new Error(error.message);
  }
}

function fileNameForRequest(request: { fileName?: string; filePath: string }) {
  if (request.fileName) return request.fileName;
  return request.filePath.split("/").pop() ?? request.filePath;
}

async function executePersistedApply(
  client: SupabaseClient<Database>,
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
        throw new Error(result.error.message);
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

export const migrationRunFunction = inngest.createFunction(
  { id: "migration-run", retries: 0 },
  { event: "carbon/migration-run" },
  async ({ event }) => {
    const client = getCarbonServiceRole();
    const payload = event.data;

    await runMigrationRun(payload, {
      loadRun: (currentPayload) => loadMigrationRun(client, currentPayload),
      updateRun: (update) => updateMigrationRun(client, payload, update),
      executeApply: (report, request) =>
        executePersistedApply(client, report, request)
    });

    return { success: true };
  }
);
