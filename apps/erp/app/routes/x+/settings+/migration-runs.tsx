import { requirePermissions } from "@carbon/auth/auth.server";
import { Button, VStack } from "@carbon/react";
import { msg } from "@lingui/core/macro";
import type { LoaderFunctionArgs } from "react-router";
import { Link, Outlet, useLoaderData } from "react-router";
import { usePermissions } from "~/hooks";
import { MigrationRunsTable } from "~/modules/settings";
import { getMigrationRuns } from "~/modules/shared";
import type { Handle } from "~/utils/handle";
import { path } from "~/utils/path";

export const handle: Handle = {
  breadcrumb: msg`Migration Runs`,
  to: path.to.migrationRuns
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { client, companyId } = await requirePermissions(request, {
    view: "settings",
    role: "employee"
  });

  const runs = await getMigrationRuns(client, companyId);

  return {
    data: runs.data ?? [],
    count: runs.count ?? 0
  };
}

export default function MigrationRunsRoute() {
  const { data, count } = useLoaderData<typeof loader>();
  const permissions = usePermissions();

  return (
    <VStack spacing={0} className="h-full">
      <MigrationRunsTable
        data={data}
        count={count}
        primaryAction={
          permissions.can("create", "settings") ? (
            <Button variant="primary" asChild>
              <Link to={path.to.newMigrationRun}>New Migration Run</Link>
            </Button>
          ) : undefined
        }
      />
      <Outlet />
    </VStack>
  );
}
