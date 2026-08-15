import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * MedScores uses Supabase Authentication only for administrators.
 * Students authenticate separately with code name + PIN and never receive
 * Supabase Auth accounts. Therefore any valid Supabase Auth session is an
 * administrator session. Keep only your own account in Authentication > Users.
 */
export async function getAdminUser() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}
