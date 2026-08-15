import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashSessionToken, STUDENT_COOKIE } from "@/lib/student-session";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_COOKIE)?.value;
  if (token) {
    const supabase = createAdminClient();
    await supabase.from("student_sessions").delete().eq("token_hash", hashSessionToken(token));
  }
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(STUDENT_COOKIE, "", { path: "/", expires: new Date(0) });
  return response;
}
