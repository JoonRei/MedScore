import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCodeName } from "@/lib/utils";
import { getWebAuthnRequestConfig } from "@/lib/webauthn";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const codeName = normalizeCodeName(String(body.codeName || ""));
    if (!/^[A-Za-z0-9_-]{4,30}$/.test(codeName)) return NextResponse.json({ error: "Enter your code name first." }, { status: 400 });
    const db = createAdminClient();
    const { data: student } = await db.from("students").select("id,is_active").eq("code_name", codeName).maybeSingle();
    if (!student?.is_active) return NextResponse.json({ error: "Device sign-in is not available for this account." }, { status: 404 });
    const { data: passkeys } = await db.from("student_passkeys").select("credential_id,transports").eq("student_id", student.id);
    if (!passkeys?.length) return NextResponse.json({ error: "Device sign-in has not been enabled for this student." }, { status: 404 });
    const config = getWebAuthnRequestConfig(request);
    const options = await generateAuthenticationOptions({
      rpID: config.rpID,
      allowCredentials: passkeys.map((passkey: any) => ({ id: passkey.credential_id, transports: passkey.transports || undefined })),
      userVerification: "required",
    });
    await db.from("student_webauthn_challenges").delete().lt("expires_at", new Date().toISOString());
    const { data: challenge, error } = await db.from("student_webauthn_challenges").insert({ student_id: student.id, purpose: "authenticate", challenge: options.challenge, expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ options, challengeId: challenge.id });
  } catch {
    return NextResponse.json({ error: "Unable to start device sign-in." }, { status: 500 });
  }
}
