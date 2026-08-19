import { NextResponse } from "next/server";
import { getAdminIdentity, recoverLegacyAdminData } from "@/lib/admin-auth";
import { ADMIN_PERIOD_COOKIE } from "@/lib/admin-workspace";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "This account is not authorized for the Admin portal." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const recovery = await recoverLegacyAdminData(identity);
  const db = createAdminClient();
  const { data: periods } = await db
    .from("academic_periods")
    .select("id,is_active")
    .eq("owner_id", identity.profile.id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true });
  const periodId = (periods || []).find((period: any) => period.is_active)?.id || periods?.[0]?.id || "";

  const response = NextResponse.json({ ok: true, recovered: recovery.recovered }, { headers: { "Cache-Control": "no-store" } });
  if (periodId) {
    response.cookies.set(ADMIN_PERIOD_COOKIE, periodId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    response.cookies.delete(ADMIN_PERIOD_COOKIE);
  }
  return response;
}
