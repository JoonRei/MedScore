import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export function configuredAdminEmail() {
  return String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
}

export function isAuthorizedAdminEmail(email?: string | null) {
  const allowed = configuredAdminEmail();
  if (!allowed || !email) return false;
  return email.trim().toLowerCase() === allowed;
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

const readAdminUser = cache(async () => {
  const user = await getAuthenticatedSupabaseUser();
  if (!user || !isAuthorizedAdminEmail(user.email)) return null;
  return user;
});

export async function getAdminUser() {
  return readAdminUser();
}

export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}
