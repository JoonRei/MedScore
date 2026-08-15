import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCodeName } from "@/lib/utils";
import {
  hashSessionToken,
  newSessionToken,
  STUDENT_COOKIE,
  STUDENT_SESSION_HOURS,
} from "@/lib/student-session";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function POST(request: Request) {
  try {
    const { codeName: rawCodeName, pin } = await request.json();
    const codeName = normalizeCodeName(String(rawCodeName || ""));
    const pinValue = String(pin || "");

    if (!/^[A-Za-z0-9_-]{4,30}$/.test(codeName) || !/^\d{4,6}$/.test(pinValue)) {
      return NextResponse.json({ error: "Code name or PIN is incorrect." }, { status: 401 });
    }

    const supabase = createAdminClient();
    const now = new Date();

    const { data: attempt } = await supabase
      .from("student_login_attempts")
      .select("attempts, locked_until")
      .eq("identifier", codeName)
      .maybeSingle();

    if (attempt?.locked_until && new Date(attempt.locked_until) > now) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Try again later." },
        { status: 429 }
      );
    }

    const { data: student } = await supabase
      .from("students")
      .select("id, pin_hash, is_active")
      .eq("code_name", codeName)
      .maybeSingle();

    const valid = Boolean(student?.is_active && student.pin_hash && (await bcrypt.compare(pinValue, student.pin_hash)));

    if (!valid) {
      const nextAttempts = (attempt?.attempts || 0) + 1;
      const lockedUntil = nextAttempts >= MAX_ATTEMPTS
        ? new Date(now.getTime() + LOCK_MINUTES * 60 * 1000).toISOString()
        : null;

      await supabase.from("student_login_attempts").upsert({
        identifier: codeName,
        attempts: nextAttempts,
        locked_until: lockedUntil,
        updated_at: now.toISOString(),
      });

      return NextResponse.json(
        { error: lockedUntil ? "Too many sign-in attempts. Try again later." : "Code name or PIN is incorrect." },
        { status: lockedUntil ? 429 : 401 }
      );
    }

    await supabase.from("student_login_attempts").delete().eq("identifier", codeName);
    await supabase.from("student_sessions").delete().eq("student_id", student!.id);

    const token = newSessionToken();
    const expiresAt = new Date(now.getTime() + STUDENT_SESSION_HOURS * 60 * 60 * 1000);
    const { error: sessionError } = await supabase.from("student_sessions").insert({
      student_id: student!.id,
      token_hash: hashSessionToken(token),
      expires_at: expiresAt.toISOString(),
    });

    if (sessionError) throw sessionError;

    const response = NextResponse.json({ ok: true });
    response.cookies.set(STUDENT_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to sign in right now." }, { status: 500 });
  }
}
