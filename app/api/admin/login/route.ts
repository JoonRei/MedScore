import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Compatibility endpoint. The Admin login form now signs in through the
 * official Supabase browser SSR client so cookies are written directly in the
 * browser. Keeping this endpoint makes older clients/bookmarks continue to work.
 */
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { error: "Enter your Admin email and password." },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: String(password),
    });

    if (error || !data.user) {
      const message = error?.message || "Invalid login credentials";
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ ok: true, email: data.user.email });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sign in right now." },
      { status: 500 }
    );
  }
}
