import { error } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const { client } = await requirePermissions(request, {
    role: "employee"
  });

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return { users: [] };
  }

  const query = await client
    .from("user")
    .select("id, firstName, lastName, fullName, email, avatarUrl")
    .eq("active", true)
    .ilike("fullName", `%${q}%`)
    .order("lastName")
    .limit(20);

  if (query.error) {
    return data(
      { users: [], error: query.error },
      await flash(request, error(query.error, "Failed to search users"))
    );
  }

  return { users: query.data ?? [] };
}
