"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const blockClipboard = (event: React.SyntheticEvent<HTMLInputElement>) => event.preventDefault();

function friendlyAuthError(message?: string) {
  const value = String(message || "").toLowerCase();
  if (value.includes("invalid login credentials")) return "Email or password is incorrect.";
  if (value.includes("email not confirmed")) return "This Admin email is not confirmed yet.";
  if (value.includes("admin_email")) return message || "Administrator access is not configured.";
  if (value.includes("invalid path") || value.includes("pgrst125")) return "The Supabase Project URL is incorrect. Use only the project base URL.";
  if (value.includes("supabase_url") || value.includes("valid url") || value.includes("project url")) return message || "Check the Supabase project configuration.";
  if (value.includes("fetch") || value.includes("network")) return "MedScores cannot reach the authentication service.";
  return message || "Unable to sign in.";
}

export function AdminLoginForm() {
  const router = useRouter();
  const [inactive, setInactive] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInactive(params.get("reason") === "inactive");
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError || !data.user || !data.session) {
        setError(friendlyAuthError(authError?.message));
        return;
      }

      const access = await fetch("/api/admin/access", { method: "GET", cache: "no-store" });
      const accessBody = await access.json().catch(() => ({}));
      if (!access.ok) {
        await supabase.auth.signOut();
        setError(friendlyAuthError(accessBody.error || "This account is not authorized for the Admin portal."));
        return;
      }

      // A successful login starts a fresh inactivity window.
      // This prevents a timestamp left by an older session from immediately signing out a new session.
      localStorage.setItem("medscores_admin_last_activity", String(Date.now()));

      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : "Unable to sign in."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      {inactive && !error && <div className="alert alert-success">You were signed out after 15 minutes of inactivity.</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          className="input"
          type="email"
          autoComplete="off"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onPaste={blockClipboard}
          onCopy={blockClipboard}
          onCut={blockClipboard}
          onDrop={blockClipboard}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          className="input"
          type="password"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onPaste={blockClipboard}
          onCopy={blockClipboard}
          onCut={blockClipboard}
          onDrop={blockClipboard}
          required
        />
      </div>
      <button className="button button-primary button-block" type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Sign in as Admin"}
      </button>
    </form>
  );
}
