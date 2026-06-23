import { assertIsPost, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { trigger } from "@carbon/jobs";
import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { getMigrationRun } from "~/modules/shared";
import { path } from "~/utils/path";

export async function action({ request, params }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, companyId, userId } = await requirePermissions(request, {
    update: "settings"
  });

  const migrationRunId = params.migrationRunId;
  if (!migrationRunId) {
    return { success: false, message: "Missing migration run ID" };
  }

  const run = await getMigrationRun(client, migrationRunId, companyId);
  if (run.error || !run.data || run.data.status !== "review-ready") {
    return { success: false, message: "Migration run is not ready to apply" };
  }

  await trigger("migration-run", {
    migrationRunId,
    companyId,
    userId,
    action: "apply"
  });

  throw redirect(
    path.to.migrationRun(migrationRunId),
    await flash(request, success("Migration run queued for apply"))
  );
}

export default function MigrationRunsApplyRoute() {
  return null;
}
