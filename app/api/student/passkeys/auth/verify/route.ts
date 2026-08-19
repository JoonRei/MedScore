import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { base64UrlToBytes, getWebAuthnRequestConfig } from "@/lib/webauthn";
import { hashSessionToken, newSessionToken, STUDENT_COOKIE, STUDENT_SESSION_HOURS } from "@/lib/student-session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const challengeId = String(body.challengeId || "");
    const response = body.response;
    if (!challengeId || !response?.id) return NextResponse.json({ error: "Fingerprint sign-in response is incomplete." }, { status: 400 });
    const db = createAdminClient();
    const { data: challenge } = await db.from("student_webauthn_challenges").select("id,student_id,challenge,expires_at,purpose").eq("id", challengeId).eq("purpose", "authenticate").maybeSingle();
    if (!challenge || new Date(challenge.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "Fingerprint sign-in expired. Try again." }, { status: 400 });
    const { data: student } = await db.from("students").select("id,is_active").eq("id", challenge.student_id).maybeSingle();
    if (!student?.is_active) return NextResponse.json({ error: "Student account is not active." }, { status: 403 });
    const { data: passkey } = await db.from("student_passkeys").select("credential_id,public_key,counter,transports").eq("credential_id", response.id).eq("student_id", student.id).maybeSingle();
    if (!passkey) return NextResponse.json({ error: "Fingerprint sign-in is not registered on this account." }, { status: 404 });
    const config = getWebAuthnRequestConfig(request);
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
      credential: {
        id: passkey.credential_id,
        publicKey: base64UrlToBytes(passkey.public_key),
        counter: Number(passkey.counter || 0),
        transports: passkey.transports || undefined,
      },
    });
    if (!verification.verified) return NextResponse.json({ error: "Fingerprint verification was not completed." }, { status: 401 });
    await Promise.all([
      db.from("student_passkeys").update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq("credential_id", passkey.credential_id),
      db.from("student_webauthn_challenges").delete().eq("id", challenge.id),
      db.from("student_sessions").delete().eq("student_id", student.id),
    ]);
    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + STUDENT_SESSION_HOURS * 60 * 60 * 1000);
    const { error: sessionError } = await db.from("student_sessions").insert({ student_id: student.id, token_hash: hashSessionToken(token), expires_at: expiresAt.toISOString() });
    if (sessionError) throw sessionError;
    const result = NextResponse.json({ ok: true, verified: true });
    result.cookies.set(STUDENT_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", expires: expiresAt });
    return result;
  } catch {
    return NextResponse.json({ error: "Unable to sign in with fingerprint." }, { status: 400 });
  }
}
