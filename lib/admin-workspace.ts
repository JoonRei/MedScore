import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminIdentity, type AdminProfile } from "@/lib/admin-auth";

export const ADMIN_PERIOD_COOKIE = "medscores_admin_period";

export type AcademicPeriod = {
  id: string;
  owner_id: string;
  academic_year: string;
  term: string;
  is_active: boolean;
};

export type AdminWorkspaceContext = {
  user: { id: string; email?: string | null };
  profile: AdminProfile;
  workspace: AdminProfile;
  periods: AcademicPeriod[];
  period: AcademicPeriod | null;
  selectedPeriodId: string;
};

export async function getAdminWorkspaceContext(): Promise<AdminWorkspaceContext | null> {
  const identity = await getAdminIdentity();
  if (!identity) return null;

  const db = createAdminClient();
  const cookieStore = await cookies();
  const workspace = identity.profile;

  const { data: periodRows } = await db
    .from("academic_periods")
    .select("id,owner_id,academic_year,term,is_active")
    .eq("owner_id", workspace.id)
    .order("academic_year", { ascending: false })
    .order("term");

  const periods = (periodRows || []) as AcademicPeriod[];
  const requestedPeriod = cookieStore.get(ADMIN_PERIOD_COOKIE)?.value;
  const period = periods.find((item) => item.id === requestedPeriod)
    || periods.find((item) => item.is_active)
    || periods[0]
    || null;
  const selectedPeriodId = period?.id || "";

  return {
    user: identity.user,
    profile: identity.profile,
    workspace,
    periods,
    period,
    selectedPeriodId,
  };
}

export async function requireAdminWorkspace() {
  const context = await getAdminWorkspaceContext();
  if (!context) redirect("/admin/login");
  return context;
}

export async function getOwnedStudent(id: string, workspaceId: string) {
  const db = createAdminClient();
  const { data } = await db.from("students").select("id,owner_id").eq("id", id).eq("owner_id", workspaceId).maybeSingle();
  return data;
}

export async function getOwnedSubject(id: string, workspaceId: string) {
  const db = createAdminClient();
  const { data } = await db.from("subjects").select("id,owner_id,academic_year,term").eq("id", id).eq("owner_id", workspaceId).maybeSingle();
  return data;
}

export async function getOwnedAssessment(id: string, workspaceId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("assessments")
    .select("id,subject_id,subjects!inner(owner_id,academic_year,term)")
    .eq("id", id)
    .eq("subjects.owner_id", workspaceId)
    .maybeSingle();
  return data;
}
