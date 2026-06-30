import { MenuItem } from "@carbon/react";
import { formatDateTime } from "@carbon/utils";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { LuArrowRight } from "react-icons/lu";
import { Link } from "react-router";
import { Table } from "~/components";
import type { MigrationRunListItem } from "~/modules/shared";
import { path } from "~/utils/path";
import MigrationRunStatusBadge from "./MigrationRunStatusBadge";

type MigrationRunsTableProps = {
  data: MigrationRunListItem[];
  count: number;
  primaryAction?: ReactNode;
};

const MigrationRunsTable = ({
  data,
  count,
  primaryAction
}: MigrationRunsTableProps) => {
  const columns = useMemo<ColumnDef<MigrationRunListItem>[]>(
    () => [
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <MigrationRunStatusBadge status={row.original.status} />
        )
      },
      {
        accessorKey: "scenario",
        header: "Scenario",
        cell: ({ row }) => (
          <div className="max-w-65 truncate font-medium">
            {row.original.scenario ?? "—"}
          </div>
        )
      },
      {
        accessorKey: "profileName",
        header: "Profile",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.profileName ?? "—"}
          </span>
        )
      },
      {
        accessorKey: "fileCount",
        header: "Files",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.fileCount ?? "—"}
          </span>
        )
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDateTime(row.original.createdAt)}
          </span>
        )
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.updatedAt
              ? formatDateTime(row.original.updatedAt)
              : "—"}
          </span>
        )
      }
    ],
    []
  );

  return (
    <Table
      data={data}
      columns={columns}
      count={count}
      title="Migration Runs"
      table="migrationRun"
      primaryAction={primaryAction}
      withSearch
      withPagination
      renderContextMenu={(row) => (
        <MenuItem asChild>
          <Link to={path.to.migrationRun(row.id)}>
            <LuArrowRight className="mr-2 size-4" />
            View
          </Link>
        </MenuItem>
      )}
    />
  );
};

export default MigrationRunsTable;
