"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const blockClipboard = (event: React.SyntheticEvent<HTMLInputElement>) => event.preventDefault();

export function StudentLoginForm() {
  const router = useRouter();
  const [inactive, setInactive] = useState(false);
  useEffect(() => {
    setInactive(new URLSearchParams(window.location.search).get("reason") === "inactive");
  }, []);
  const [codeName, setCodeName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeName, pin }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || "Code name or PIN is incorrect.");
        return;
      }
      router.replace("/student");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      {inactive && !error && <div className="alert alert-success">You were signed out after 15 minutes of inactivity.</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label htmlFor="code-name">Code Name</label>
        <input
          id="code-name"
          className="input"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={codeName}
          onChange={(e) => setCodeName(e.target.value)}
          onPaste={blockClipboard}
          onCopy={blockClipboard}
          onCut={blockClipboard}
          onDrop={blockClipboard}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="pin">PIN</label>
        <input
          id="pin"
          className="input pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onPaste={blockClipboard}
          onCopy={blockClipboard}
          onCut={blockClipboard}
          onDrop={blockClipboard}
          required
        />
      </div>
      <button className="button button-primary button-block" type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
