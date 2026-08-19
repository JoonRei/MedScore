import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getStudentSession } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { bytesToBase64Url, getWebAuthnRequestConfig } from "@/lib/webauthn";

export async function POST(request: Request) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { student } = session;
  try {
    const body = await request.json();
    const challengeId = String(body.challengeId || "");
    const response = body.response;
    if (!challengeId || !response?.id) return NextResponse.json({ error: "Device registration response is incomplete." }, { status: 400 });
    const db = createAdminClient();
    const { data: challenge } = await db.from("student_webauthn_challenges").select("id,student_id,challenge,expires_at,purpose").eq("id", challengeId).eq("student_id", student.id).eq("purpose", "register").maybeSingle();
    if (!challenge || new Date(challenge.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "Device registration expired. Try again." }, { status: 400 });
    const config = getWebAuthnRequestConfig(request);
    const verification = await verifyRegistrationResponse({ response, expectedChallenge: challenge.challenge, expectedOrigin: config.origin, expectedRPID: config.rpID, requireUserVerification: true });
    if (!verification.verified || !verification.registrationInfo) return NextResponse.json({ error: "Device verification was not completed." }, { status: 400 });
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const webauthnUserId = Buffer.from(student.id, "utf8").toString("base64url");
    const { error } = await db.from("student_passkeys").upsert({
      credential_id: credential.id,
      student_id: student.id,
      webauthn_user_id: webauthnUserId,
      public_key: bytesToBase64Url(credential.publicKey),
      counter: credential.counter,
      device_type: credentialDeviceType,
      backed_up: credentialBackedUp,
      transports: credential.transports || null,
    }, { onConflict: "credential_id" });
    if (error) throw error;
    await db.from("student_webauthn_challenges").delete().eq("id", challenge.id);
    return NextResponse.json({ ok: true, verified: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to enable device sign-in." }, { status: 400 });
  }
}
