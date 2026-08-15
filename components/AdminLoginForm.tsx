"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyIcon, LockIcon } from "@/components/icons";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

function friendlyAuthError(message?: string) {
  const value = String(message || "").toLowerCase();

  if (value.includes("invalid login credentials")) {
    return "Email or password is incorrect. Make sure this account exists in Supabase Authentication > Users.";
  }
  if (value.includes("email not confirmed")) {
    return "This Admin email is not confirmed yet. Confirm the user in Supabase Authentication, then try again.";
  }
  if (value.includes("email logins are disabled") || value.includes("provider")) {
    return "Email/password sign-in is disabled in Supabase Authentication settings.";
  }
  if (value.includes("invalid path") || value.includes("pgrst125")) {
    return "The Supabase Project URL is incorrect. Use only the project base URL, such as https://your-project-ref.supabase.co — do not include /rest/v1, /auth/v1, or a Dashboard path.";
  }
  if (value.includes("supabase_url") || value.includes("valid url") || value.includes("project url")) {
    return message || "Check NEXT_PUBLIC_SUPABASE_URL in .env.local.";
  }
  if (value.includes("fetch") || value.includes("network")) {
    return "MedScores cannot reach Supabase. Check the Project URL, publishable key, and your internet connection.";
  }

  return message || "Unable to sign in.";
}

export function AdminLoginForm() {
  const router = useRouter();
  const [inactive, setInactive] = useState(false);
  useEffect(() => {
    setInactive(new URLSearchParams(window.location.search).get("reason") === "inactive");
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

      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(
        friendlyAuthError(err instanceof Error ? err.message : "Unable to sign in.")
      );
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
        <div className="input-shell">
          <KeyIcon size={18} />
          <input
            id="admin-email"
            className="input"
            type="email"
            autoComplete="username"
            placeholder="Admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="admin-password">Password</label>
        <div className="input-shell">
          <LockIcon size={18} />
          <input
            id="admin-password"
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
      </div>
      <button
        className="button button-primary button-block"
        type="submit"
        disabled={loading}
      >
        {loading ? "Signing in…" : "Sign in as Admin"}
      </button>
    </form>
  );
}
