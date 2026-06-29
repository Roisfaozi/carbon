import { getCarbonServiceRole } from "@carbon/auth/client.server";
import type { Database } from "@carbon/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MigrationDryRunReport } from "../../../../../database/supabase/functions/import-csv/migration-runner.ts";
import { inngest } from "../../client";
import type {
  MigrationRunPayload,
  MigrationRunUpdate,
  PersistedMigrationRun,
  PersistedMigrationRunRequest
} from "./migration-run.core";
import { executePersistedApply, runMigrationRun } from "./migration-run.core";

export type {
  MigrationRunPayload,
  MigrationRunUpdate,
  PersistedMigrationRun,
  PersistedMigrationRunRequest
} from "./migration-run.core";
export { executePersistedApply, runMigrationRun } from "./migration-run.core";

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
