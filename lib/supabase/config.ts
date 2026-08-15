/**
 * Accepts the normal Supabase Project URL, but also repairs common copy/paste
 * mistakes such as URLs ending in /rest/v1 or /auth/v1 and Dashboard URLs.
 * The Supabase JS clients expect the project base URL only.
 */
export function normalizeSupabaseUrl(rawValue: string | undefined): string {
  let raw = String(rawValue || "").trim();

  // Environment files are sometimes copied with wrapping quotes.
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1).trim();
  }

  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is missing. Copy the Project URL from the Supabase project Connect dialog."
    );
  }

  // Handle a project Dashboard URL pasted by mistake, e.g.
  // https://supabase.com/dashboard/project/abcdefghijklmnopqrst/settings/api
  const dashboardMatch = raw.match(
    /^https?:\/\/(?:app\.)?supabase\.com\/(?:dashboard\/)?project\/([a-z0-9]+)(?:\/.*)?$/i
  );
  if (dashboardMatch?.[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  // A user may paste only project-ref.supabase.co.
  if (/^[a-z0-9-]+\.supabase\.co(?:\/.*)?$/i.test(raw)) {
    raw = `https://${raw}`;
  }

  // A Postgres direct connection URL is not an API URL, but we can recover
  // the project ref from db.<ref>.supabase.co or the postgres.<ref> username.
  if (/^postgres(?:ql)?:\/\//i.test(raw)) {
    try {
      const connection = new URL(raw);
      const dbHost = connection.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
      if (dbHost?.[1]) return `https://${dbHost[1]}.supabase.co`;

      const userRef = decodeURIComponent(connection.username || "").match(
        /^postgres\.([a-z0-9]+)$/i
      );
      if (userRef?.[1]) return `https://${userRef[1]}.supabase.co`;
    } catch {
      // Fall through to the clearer error below.
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not a valid URL. Use your Supabase Project URL, for example https://your-project-ref.supabase.co."
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be an http(s) Project URL, not a database connection string."
    );
  }

  // If the hostname is db.<ref>.supabase.co, convert it to the API host.
  const dbHost = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (dbHost?.[1]) {
    return `https://${dbHost[1]}.supabase.co`;
  }

  // Supabase clients append /auth/v1 and /rest/v1 themselves. Keeping any
  // copied path here is the source of PGRST125 "Invalid path" errors.
  return parsed.origin;
}

export function publicSupabaseConfig() {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key?.trim()) {
    throw new Error(
      "Supabase public key is missing. Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) to .env.local."
    );
  }

  return { url, key: key.trim() };
}
