import { error } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { client, companyId } = await requirePermissions(request, {
    role: "employee"
  });

  const { groupId } = params;
  if (!groupId) {
    throw new Response("Group ID is required", { status: 400 });
  }

  const query = await client
    .from("groups")
    .select("users")
    .eq("id", groupId)
    .eq("companyId", companyId)
    .single();

  if (query.error) {
    return data(
      { users: [], error: query.error },
      await flash(request, error(query.error, "Failed to load group members"))
    );
  }

  return { users: query.data.users ?? [] };
}
