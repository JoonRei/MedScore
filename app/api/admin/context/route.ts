import { NextResponse } from "next/server";
import { getAdminWorkspaceContext, ADMIN_PERIOD_COOKIE } from "@/lib/admin-workspace";
import { createAdminClient } from "@/lib/supabase/admin";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}

export async function POST(request: Request) {
  const context = await getAdminWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const requestedPeriod = String(body.periodId || "");
    if (!requestedPeriod) return NextResponse.json({ error: "Choose a semester." }, { status: 400 });

    const db = createAdminClient();
    const { data: period } = await db
      .from("academic_periods")
      .select("id")
      .eq("id", requestedPeriod)
      .eq("owner_id", context.profile.id)
      .maybeSingle();

    if (!period) return NextResponse.json({ error: "Academic period not found for this account." }, { status: 404 });

    const { error: clearError } = await db
      .from("academic_periods")
      .update({ is_active: false })
      .eq("owner_id", context.profile.id)
      .eq("is_active", true);
    if (clearError) throw clearError;

    const { error: activeError } = await db
      .from("academic_periods")
      .update({ is_active: true })
      .eq("id", requestedPeriod)
      .eq("owner_id", context.profile.id);
    if (activeError) throw activeError;

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_PERIOD_COOKIE, requestedPeriod, cookieOptions());
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to switch semester." }, { status: 500 });
  }
}
