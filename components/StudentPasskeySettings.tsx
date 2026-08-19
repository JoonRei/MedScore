"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startRegistration } from "@simplewebauthn/browser";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FingerprintMark } from "@/components/FingerprintMark";

export function StudentPasskeySettings({ count }: { count: number }) {
  const router = useRouter();
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      const available = browserSupportsWebAuthn() && await platformAuthenticatorIsAvailable().catch(() => false);
      if (active) setSupported(available);
    })();
    return () => { active = false; };
  }, []);

  async function enable() {
    setBusy(true); setError(""); setNotice("");
    try {
      const optionsResponse = await fetch("/api/student/passkeys/register/options", { method: "POST" });
      const optionsBody = await optionsResponse.json().catch(() => ({}));
      if (!optionsResponse.ok) { setError(optionsBody.error || "Unable to prepare fingerprint sign-in."); return; }
      const credential = await startRegistration({ optionsJSON: optionsBody.options });
      const verifyResponse = await fetch("/api/student/passkeys/register/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: optionsBody.challengeId, response: credential }) });
      const verifyBody = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok || !verifyBody.verified) { setError(verifyBody.error || "Fingerprint sign-in could not be enabled."); return; }
      setNotice("Fingerprint sign-in is ready. You can use this device instead of entering your PIN next time.");
      router.refresh();
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      setError(name === "NotAllowedError" ? "Fingerprint verification was cancelled." : "Fingerprint sign-in could not be enabled on this device.");
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/student/passkeys", { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error || "Unable to disable fingerprint sign-in."); return; }
      setConfirmDisable(false); setNotice("Fingerprint sign-in disabled. Your PIN remains unchanged."); router.refresh();
    } finally { setBusy(false); }
  }

  return <div className="passkey-settings fingerprint-settings">
    {(notice || error) && <div className={`alert ${error ? "alert-error" : "alert-success"}`}>{error || notice}</div>}
    <div className="student-settings-row passkey-settings-row fingerprint-settings-row">
      <div className="fingerprint-settings-copy">
        <span className="fingerprint-settings-mark"><FingerprintMark /></span>
        <div className="student-settings-copy"><h3>Fingerprint</h3><p>Use secure biometric verification instead of entering your PIN.</p></div>
      </div>
      <div className="passkey-actions">
        <span className="settings-value">{count ? `${count} device${count === 1 ? "" : "s"}` : supported ? "Available" : "Not supported"}</span>
        {supported && <button className="button button-secondary button-sm" type="button" disabled={busy} onClick={() => void enable()}>{busy ? "Working…" : count ? "Add device" : "Enable"}</button>}
        {count > 0 && <button className="button button-quiet button-sm" type="button" disabled={busy} onClick={() => setConfirmDisable(true)}>Disable</button>}
      </div>
    </div>
    <ConfirmDialog open={confirmDisable} title="Disable fingerprint sign-in?" description="Registered fingerprint sign-in credentials for your MedScores student account will be removed. You can continue signing in with your code name and PIN." confirmLabel="Disable" busyLabel="Disabling…" busy={busy} onCancel={() => !busy && setConfirmDisable(false)} onConfirm={() => void disable()} />
  </div>;
}
