import { NextRequest, connection } from "next/server";
import { auth } from "@/lib/auth";
import { canAdminManageUsers } from "@/features/users/permissions/users";
import { getUsersPaginatedFromDb } from "@/features/users/db/users";

const SUGGEST_LIMIT = 10;

/** GET ?q=... - Returns user suggestions for search (name, email, phone, country). Admin only. */
export async function GET(request: NextRequest) {
  await connection();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !canAdminManageUsers(session.user.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q || q.length < 1) {
    return Response.json({ users: [] });
  }
  const { users } = await getUsersPaginatedFromDb({
    page: 1,
    limit: SUGGEST_LIMIT,
    search: q,
  });
  return Response.json({ users });
}
