import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import { getStudentSession } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWebAuthnRequestConfig } from "@/lib/webauthn";

export async function POST(request: Request) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { student } = session;
  try {
    const db = createAdminClient();
    const config = getWebAuthnRequestConfig(request);
    await db.from("student_webauthn_challenges").delete().lt("expires_at", new Date().toISOString());
    const { data: passkeys } = await db.from("student_passkeys").select("credential_id,transports").eq("student_id", student.id);
    const options = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpID,
      userID: isoUint8Array.fromUTF8String(student.id),
      userName: student.code_name,
      userDisplayName: student.code_name,
      attestationType: "none",
      excludeCredentials: (passkeys || []).map((passkey: any) => ({ id: passkey.credential_id, transports: passkey.transports || undefined })),
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "required",
      },
      supportedAlgorithmIDs: [-7, -257],
    });
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { data: challenge, error } = await db.from("student_webauthn_challenges").insert({ student_id: student.id, purpose: "register", challenge: options.challenge, expires_at: expiresAt }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ options, challengeId: challenge.id });
  } catch {
    return NextResponse.json({ error: "Unable to prepare device sign-in." }, { status: 500 });
  }
}
