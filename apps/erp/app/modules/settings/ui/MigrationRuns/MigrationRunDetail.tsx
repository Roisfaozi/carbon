import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CodeBlock,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  HStack
} from "@carbon/react";
import { formatDateTime } from "@carbon/utils";
import { Form, useNavigate } from "react-router";
import type { MigrationRun } from "~/modules/shared";
import { path } from "~/utils/path";
import MigrationRunStatusBadge, {
  getMigrationRunStatusLabel
} from "./MigrationRunStatusBadge";

type MigrationRunDetailProps = {
  run: MigrationRun;
};

function toJson(value: unknown) {
  return JSON.stringify(value ?? null, null, 2);
}

function JsonCard({ title, value }: { title: string; value: unknown }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CodeBlock className="language-javascript">{toJson(value)}</CodeBlock>
      </CardContent>
    </Card>
  );
}

const MigrationRunDetail = ({ run }: MigrationRunDetailProps) => {
  const navigate = useNavigate();
  const canApply = run.status === "review-ready";

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) navigate(path.to.migrationRuns);
      }}
    >
      <DrawerContent size="xl">
        <DrawerHeader>
          <HStack className="items-center justify-between pr-10">
            <div>
              <DrawerTitle>{run.request.scenario ?? run.id}</DrawerTitle>
              <p className="mt-1 text-xs text-muted-foreground font-mono">
                {run.id}
              </p>
            </div>
            <MigrationRunStatusBadge status={run.status} />
          </HStack>
        </DrawerHeader>
        <DrawerBody className="gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Status
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    {getMigrationRunStatusLabel(run.status)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Created
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    {formatDateTime(run.createdAt)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Updated
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    {run.updatedAt ? formatDateTime(run.updatedAt) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Profile
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    {run.request.profile.name ?? run.request.profile.id ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Files
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    {Object.keys(run.request.files).length}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    File Path Prefix
                  </div>
                  <div className="mt-1 break-all text-sm text-foreground">
                    {run.request.filePathPrefix ?? "—"}
                  </div>
                </div>
              </div>
              {run.error && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Error
                  </div>
                  <pre className="mt-1 whitespace-pre-wrap rounded-md bg-red-500/10 p-3 text-sm text-red-500">
                    {run.error}
                  </pre>
                </div>
              )}
              <Form method="post" action={path.to.applyMigrationRun(run.id)}>
                <Button type="submit" isDisabled={!canApply}>
                  Queue Apply
                </Button>
              </Form>
            </CardContent>
          </Card>

          <JsonCard title="Request" value={run.request} />
          <JsonCard title="Dry Run Summary" value={run.dryRunSummary} />
          <JsonCard title="Plan Snapshot" value={run.planSnapshot} />
          <JsonCard title="Apply Summary" value={run.applySummary} />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
};

export default MigrationRunDetail;
