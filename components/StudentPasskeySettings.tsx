"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startRegistration } from "@simplewebauthn/browser";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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
      if (!optionsResponse.ok) { setError(optionsBody.error || "Unable to prepare device sign-in."); return; }
      const credential = await startRegistration({ optionsJSON: optionsBody.options });
      const verifyResponse = await fetch("/api/student/passkeys/register/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: optionsBody.challengeId, response: credential }) });
      const verifyBody = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok || !verifyBody.verified) { setError(verifyBody.error || "Device sign-in could not be enabled."); return; }
      setNotice("Device sign-in is ready. You can use this device instead of entering your PIN next time.");
      router.refresh();
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      setError(name === "NotAllowedError" ? "Device verification was cancelled." : "Device sign-in could not be enabled on this device.");
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/student/passkeys", { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error || "Unable to disable device sign-in."); return; }
      setConfirmDisable(false); setNotice("Device sign-in disabled. Your PIN remains unchanged."); router.refresh();
    } finally { setBusy(false); }
  }

  return <div className="passkey-settings">
    {(notice || error) && <div className={`alert ${error ? "alert-error" : "alert-success"}`}>{error || notice}</div>}
    <div className="student-settings-row passkey-settings-row">
      <div className="student-settings-copy"><h3>Fingerprint / Face ID</h3><p>Use secure device verification instead of entering your PIN on this device.</p></div>
      <div className="passkey-actions">
        <span className="settings-value">{count ? `${count} registered` : supported ? "Available" : "Not supported"}</span>
        {supported && <button className="button button-secondary button-sm" type="button" disabled={busy} onClick={() => void enable()}>{busy ? "Working…" : count ? "Add this device" : "Enable"}</button>}
        {count > 0 && <button className="button button-quiet button-sm" type="button" disabled={busy} onClick={() => setConfirmDisable(true)}>Disable</button>}
      </div>
    </div>
    <ConfirmDialog open={confirmDisable} title="Disable device sign-in?" description="All registered device credentials for your MedScores student account will be removed. You can continue signing in with your code name and PIN." confirmLabel="Disable" busyLabel="Disabling…" busy={busy} onCancel={() => !busy && setConfirmDisable(false)} onConfirm={() => void disable()} />
  </div>;
}
