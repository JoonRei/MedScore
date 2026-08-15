import { NextResponse } from "next/server";
import { configuredAdminEmail, getAuthenticatedSupabaseUser, isAuthorizedAdminEmail } from "@/lib/admin-auth";

export async function GET() {
  if (!configuredAdminEmail()) {
    return NextResponse.json({ error: "ADMIN_EMAIL is not configured on the server." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  const user = await getAuthenticatedSupabaseUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication session is invalid." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  if (!isAuthorizedAdminEmail(user.email)) {
    return NextResponse.json({ error: "This account is not authorized for the Admin portal." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
