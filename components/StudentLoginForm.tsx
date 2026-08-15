"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyIcon, LockIcon } from "@/components/icons";

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
        <div className="input-shell">
          <KeyIcon size={18}/>
          <input
            id="code-name"
            className="input"
            autoComplete="username"
            autoCapitalize="none"
            placeholder="Enter your private code"
            value={codeName}
            onChange={(e) => setCodeName(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="pin">PIN</label>
        <div className="input-shell">
          <LockIcon size={18}/>
          <input
            id="pin"
            className="input"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={6}
            placeholder="Enter your PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            required
          />
        </div>
      </div>
      <button className="button button-primary button-block" type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
