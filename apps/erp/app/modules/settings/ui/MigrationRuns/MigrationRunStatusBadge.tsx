import { Badge } from "@carbon/react";
import type { MigrationRunStatus } from "~/modules/shared";

const statusConfig: Record<
  MigrationRunStatus,
  {
    label: string;
    variant: "yellow" | "blue" | "green" | "red" | "orange";
  }
> = {
  "queued-dry-run": {
    label: "Queued Dry Run",
    variant: "yellow"
  },
  "running-dry-run": {
    label: "Running Dry Run",
    variant: "blue"
  },
  "review-ready": {
    label: "Review Ready",
    variant: "green"
  },
  "queued-apply": {
    label: "Queued Apply",
    variant: "orange"
  },
  "running-apply": {
    label: "Running Apply",
    variant: "blue"
  },
  applied: {
    label: "Applied",
    variant: "green"
  },
  failed: {
    label: "Failed",
    variant: "red"
  }
};

export function getMigrationRunStatusLabel(status?: string | null) {
  if (!status) return "Unknown";
  return statusConfig[status as MigrationRunStatus]?.label ?? status;
}

type MigrationRunStatusBadgeProps = {
  status?: string | null;
};

const MigrationRunStatusBadge = ({ status }: MigrationRunStatusBadgeProps) => {
  const config = status ? statusConfig[status as MigrationRunStatus] : null;

  return (
    <Badge variant={config?.variant ?? "secondary"} className="shrink-0">
      {config?.label ?? "Unknown"}
    </Badge>
  );
};

export default MigrationRunStatusBadge;
