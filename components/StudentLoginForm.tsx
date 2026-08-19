"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication } from "@simplewebauthn/browser";
import { FingerprintMark } from "@/components/FingerprintMark";

const blockClipboard = (event: React.SyntheticEvent<HTMLInputElement>) => event.preventDefault();

export function StudentLoginForm() {
  const router = useRouter();
  const [inactive, setInactive] = useState(false);
  const [deviceSupported, setDeviceSupported] = useState(false);
  const [codeName, setCodeName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [checkingDevice, setCheckingDevice] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("student-login-lock");
    document.body.classList.add("student-login-lock");
    return () => {
      document.documentElement.classList.remove("student-login-lock");
      document.body.classList.remove("student-login-lock");
    };
  }, []);

  useEffect(() => {
    let active = true;
    setInactive(new URLSearchParams(window.location.search).get("reason") === "inactive");
    void (async () => {
      const available = browserSupportsWebAuthn() && await platformAuthenticatorIsAvailable().catch(() => false);
      if (active) setDeviceSupported(available);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!deviceSupported || !/^[A-Za-z0-9_-]{4,30}$/.test(codeName.trim())) {
      setDeviceEnabled(false);
      setCheckingDevice(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setCheckingDevice(true);
      void fetch("/api/student/passkeys/auth/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeName }),
        signal: controller.signal,
      })
        .then((response) => response.json())
        .then((body) => setDeviceEnabled(Boolean(body.enabled)))
        .catch(() => setDeviceEnabled(false))
        .finally(() => setCheckingDevice(false));
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [codeName, deviceSupported]);

  function finishLogin() {
    localStorage.setItem("medscores_student_last_activity", String(Date.now()));
    router.replace("/student");
    router.refresh();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setLoading(true);
    try {
      const response = await fetch("/api/student/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codeName, pin }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error || "Code name or PIN is incorrect."); return; }
      finishLogin();
    } finally { setLoading(false); }
  }

  async function fingerprintSignIn() {
    setError("");
    if (!deviceEnabled || !codeName.trim()) return;
    setDeviceLoading(true);
    try {
      const optionsResponse = await fetch("/api/student/passkeys/auth/options", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codeName }) });
      const optionsBody = await optionsResponse.json().catch(() => ({}));
      if (!optionsResponse.ok) { setDeviceEnabled(false); setError(optionsBody.error || "Fingerprint sign-in is not available."); return; }
      const credential = await startAuthentication({ optionsJSON: optionsBody.options });
      const verifyResponse = await fetch("/api/student/passkeys/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: optionsBody.challengeId, response: credential }) });
      const verifyBody = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok || !verifyBody.verified) { setError(verifyBody.error || "Fingerprint sign-in failed."); return; }
      finishLogin();
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      setError(name === "NotAllowedError" ? "Fingerprint verification was cancelled." : "Unable to use fingerprint sign-in right now.");
    } finally { setDeviceLoading(false); }
  }

  const hasValidCode = /^[A-Za-z0-9_-]{4,30}$/.test(codeName.trim());
  const fingerprintButtonDisabled = loading || deviceLoading || checkingDevice || !deviceEnabled;
  const fingerprintHint = !hasValidCode
    ? "Enter your code name first"
    : checkingDevice
      ? "Checking fingerprint access"
      : deviceEnabled
        ? "Ready on this account"
        : "Enable Fingerprint in Settings first";

  return <form className="login-form" onSubmit={submit} autoComplete="off" data-form-type="other">
    {inactive && !error && <div className="alert alert-success">You were signed out after 15 minutes of inactivity.</div>}
    {error && <div className="alert alert-error">{error}</div>}
    <div className="field"><label htmlFor="code-name">Code Name</label><input id="code-name" name="ms-student-code" className="input" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} data-lpignore="true" data-1p-ignore="true" value={codeName} onChange={(e) => { setCodeName(e.target.value); setDeviceEnabled(false); }} onPaste={blockClipboard} onCopy={blockClipboard} onCut={blockClipboard} onDrop={blockClipboard} onContextMenu={(event) => event.preventDefault()} required /></div>
    <div className="field"><label htmlFor="pin">PIN</label><input id="pin" name="ms-student-pin" className="input pin-input" type="password" inputMode="numeric" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} data-lpignore="true" data-1p-ignore="true" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} onPaste={blockClipboard} onCopy={blockClipboard} onCut={blockClipboard} onDrop={blockClipboard} onContextMenu={(event) => event.preventDefault()} required /></div>
    <button className="button button-primary button-block" type="submit" disabled={loading || deviceLoading}>{loading ? "Signing in…" : "Sign in"}</button>
    {deviceSupported && <div className="login-device-option fingerprint-login-option">
      <span className="login-device-or">or</span>
      <button className={`fingerprint-login-button${deviceLoading ? " is-scanning" : ""}`} type="button" disabled={fingerprintButtonDisabled} onClick={() => void fingerprintSignIn()}>
        <span className="fingerprint-login-mark"><FingerprintMark /></span>
        <span className="fingerprint-login-copy"><strong>{deviceLoading ? "Verifying fingerprint…" : checkingDevice ? "Checking fingerprint…" : "Use fingerprint"}</strong><small>{fingerprintHint}</small></span>
      </button>
    </div>}
  </form>;
}
