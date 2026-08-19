import "server-only";
import crypto from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export const STUDENT_COOKIE = "medscores_student_session";
export const STUDENT_SESSION_HOURS = 12;

export function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

const readStudentSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_COOKIE)?.value;
  if (!token) return null;

  const supabase = createAdminClient();
  const tokenHash = hashSessionToken(token);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("student_sessions")
    .select("id, expires_at, students(id, owner_id, first_name, last_name, code_name, year_level, is_active)")
    .eq("token_hash", tokenHash)
    .gt("expires_at", now)
    .maybeSingle();

  if (error || !data) return null;
  const student = Array.isArray(data.students) ? data.students[0] : data.students;
  if (!student || !student.is_active) return null;

  return { sessionId: data.id, expiresAt: data.expires_at, student };
});

export async function getStudentSession() {
  return readStudentSession();
}

export async function requireStudent() {
  const session = await getStudentSession();
  if (!session) redirect("/");
  return session;
}
