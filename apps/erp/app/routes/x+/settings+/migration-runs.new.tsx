import { assertIsPost, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { validationError, validator } from "@carbon/form";
import { trigger } from "@carbon/jobs";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useNavigate } from "react-router";
import {
  MigrationRunForm,
  migrationRunRequestValidator
} from "~/modules/settings";
import { createMigrationRun } from "~/modules/shared";
import { path } from "~/utils/path";

export async function loader({ request }: LoaderFunctionArgs) {
  await requirePermissions(request, {
    update: "settings"
  });

  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, companyId, userId } = await requirePermissions(request, {
    update: "settings"
  });

  const formData = await request.formData();
  const validation = await validator(migrationRunRequestValidator).validate(
    formData
  );

  if (validation.error) {
    return validationError(validation.error);
  }

  const result = await createMigrationRun(client, {
    request: validation.data,
    companyId,
    userId
  });

  if (result.error || !result.data) {
    return {
      success: false,
      message: result.error?.message ?? "Failed to create run"
    };
  }

  await trigger("migration-run", {
    migrationRunId: result.data.id,
    companyId,
    userId,
    action: "dry-run"
  });

  throw redirect(
    path.to.migrationRun(result.data.id),
    await flash(request, success("Migration run created"))
  );
}

export default function MigrationRunsNewRoute() {
  const navigate = useNavigate();

  return <MigrationRunForm onClose={() => navigate(-1)} />;
}
