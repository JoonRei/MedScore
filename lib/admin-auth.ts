import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminProfile = {
  id: string;
  email: string;
  display_name: string;
  role: "owner" | "member";
  is_active: boolean;
};

export function configuredAdminEmail() {
  return String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
}

const readAuthenticatedSupabaseUser = cache(async () => {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
});

export async function getAuthenticatedSupabaseUser() {
  return readAuthenticatedSupabaseUser();
}

async function ensureAdminProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  const email = String(user.email || "").trim().toLowerCase();
  if (!email) return null;

  const db = createAdminClient();
  const ownerEmail = configuredAdminEmail();
  const requestedRole: "owner" | "member" = ownerEmail && email === ownerEmail ? "owner" : "member";
  const metadataName = String(user.user_metadata?.display_name || user.user_metadata?.name || "").trim();
  const fallbackName = email.split("@")[0] || "Administrator";

  const { data: existing, error } = await db
    .from("admin_profiles")
    .select("id,email,display_name,role,is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return null;

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (existing.email !== email) patch.email = email;
    if (requestedRole === "owner" && existing.role !== "owner") patch.role = "owner";
    if (!existing.display_name && metadataName) patch.display_name = metadataName;
    if (Object.keys(patch).length) {
      const { data: updated } = await db
        .from("admin_profiles")
        .update(patch)
        .eq("id", user.id)
        .select("id,email,display_name,role,is_active")
        .single();
      return (updated || existing) as AdminProfile;
    }
    return existing as AdminProfile;
  }

  // V4.2: any account that already exists in Supabase Authentication can use
  // the Admin portal. There is no in-app registration and every auth user owns
  // only the records they create under their own user id.
  const { data } = await db
    .from("admin_profiles")
    .insert({
      id: user.id,
      email,
      display_name: metadataName || fallbackName,
      role: requestedRole,
      is_active: true,
    })
    .select("id,email,display_name,role,is_active")
    .single();
  return (data || null) as AdminProfile | null;
}


/**
 * V4.3 compatibility recovery.
 *
 * V4.1 assigned records from single-admin installations to whichever account
 * happened to be the bootstrap owner. If that was not the configured original
 * Admin, V4.2 account isolation could make those older records look missing.
 *
 * Only the configured original Admin can run this recovery. It moves only rows
 * that clearly pre-date the bootstrap profile itself, so records created later
 * by another Admin remain with that Admin.
 */
export async function recoverLegacyAdminData(identity: { user: { id: string; email?: string | null }; profile: AdminProfile }) {
  const email = String(identity.user.email || identity.profile.email || "").trim().toLowerCase();
  if (!email || email !== configuredAdminEmail()) return { recovered: false, moved: 0 };

  try {
    const db = createAdminClient();
    const { data: candidates } = await db
      .from("admin_profiles")
      .select("id,created_at,role")
      .eq("role", "owner")
      .neq("id", identity.user.id)
      .order("created_at", { ascending: true });

    for (const candidate of candidates || []) {
      if (!candidate?.id || !candidate?.created_at) continue;
      const cutoff = String(candidate.created_at);

      const [{ data: oldStudents }, { data: oldSubjects }, { data: oldPeriods }] = await Promise.all([
        db.from("students").select("id").eq("owner_id", candidate.id).lt("created_at", cutoff),
        db.from("subjects").select("id,academic_year,term").eq("owner_id", candidate.id).lt("created_at", cutoff),
        db.from("academic_periods").select("id,academic_year,term,is_active,created_at").eq("owner_id", candidate.id).lt("created_at", cutoff),
      ]);

      const studentRows = oldStudents || [];
      const subjectRows = oldSubjects || [];
      const periodRows = oldPeriods || [];
      if (!studentRows.length && !subjectRows.length) continue;

      const periodKeys = new Map<string, { academic_year: string; term: string; is_active: boolean }>();
      for (const period of periodRows) {
        periodKeys.set(`${period.academic_year}|||${period.term}`, {
          academic_year: period.academic_year,
          term: period.term,
          is_active: Boolean(period.is_active),
        });
      }
      for (const subject of subjectRows) {
        const key = `${subject.academic_year}|||${subject.term}`;
        if (!periodKeys.has(key)) {
          periodKeys.set(key, { academic_year: subject.academic_year, term: subject.term, is_active: false });
        }
      }

      const [{ error: studentMoveError }, { error: subjectMoveError }] = await Promise.all([
        studentRows.length
          ? db.from("students").update({ owner_id: identity.user.id }).eq("owner_id", candidate.id).lt("created_at", cutoff)
          : Promise.resolve({ error: null }),
        subjectRows.length
          ? db.from("subjects").update({ owner_id: identity.user.id }).eq("owner_id", candidate.id).lt("created_at", cutoff)
          : Promise.resolve({ error: null }),
      ]);
      if (studentMoveError || subjectMoveError) continue;

      const { data: currentPeriods } = await db
        .from("academic_periods")
        .select("id,academic_year,term,is_active")
        .eq("owner_id", identity.user.id);
      const existing = new Map((currentPeriods || []).map((period) => [`${period.academic_year}|||${period.term}`, period]));
      let currentActive = (currentPeriods || []).some((period) => period.is_active);
      let preferredActiveKey = "";

      for (const [key, period] of periodKeys) {
        if (period.is_active) preferredActiveKey = key;
        if (existing.has(key)) continue;
        const { data: inserted } = await db
          .from("academic_periods")
          .insert({
            owner_id: identity.user.id,
            academic_year: period.academic_year,
            term: period.term,
            is_active: false,
          })
          .select("id,academic_year,term,is_active")
          .maybeSingle();
        if (inserted) existing.set(key, inserted);
      }

      if (!currentActive && preferredActiveKey && existing.get(preferredActiveKey)?.id) {
        await db
          .from("academic_periods")
          .update({ is_active: true })
          .eq("id", existing.get(preferredActiveKey)!.id)
          .eq("owner_id", identity.user.id);
        currentActive = true;
      }

      if (periodRows.length) {
        await db.from("academic_periods").delete().eq("owner_id", candidate.id).lt("created_at", cutoff);
      }

      return { recovered: true, moved: studentRows.length + subjectRows.length };
    }
  } catch {
    // Recovery must never block a valid Admin login.
  }

  return { recovered: false, moved: 0 };
}

const readAdminIdentity = cache(async () => {
  const user = await getAuthenticatedSupabaseUser();
  if (!user) return null;
  const profile = await ensureAdminProfile(user);
  if (!profile || !profile.is_active) return null;
  return { user, profile };
});

export async function getAdminIdentity() {
  return readAdminIdentity();
}

export async function getAdminUser() {
  const identity = await getAdminIdentity();
  return identity?.user || null;
}

export async function requireAdmin() {
  const identity = await getAdminIdentity();
  if (!identity) redirect("/admin/login");
  return identity.user;
}

export async function requireAdminIdentity() {
  const identity = await getAdminIdentity();
  if (!identity) redirect("/admin/login");
  return identity;
}
