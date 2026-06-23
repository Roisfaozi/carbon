import { requirePermissions } from "@carbon/auth/auth.server";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { MigrationRunDetail } from "~/modules/settings";
import { getMigrationRun } from "~/modules/shared";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { client, companyId } = await requirePermissions(request, {
    view: "settings",
    role: "employee"
  });

  const migrationRunId = params.migrationRunId;
  if (!migrationRunId) throw new Error("Missing migration run ID");

  const run = await getMigrationRun(client, migrationRunId, companyId);

  return {
    run: run.data
  };
}

export default function MigrationRunsDetailRoute() {
  const { run } = useLoaderData<typeof loader>();
  if (!run) return null;

  return <MigrationRunDetail run={run} />;
}
