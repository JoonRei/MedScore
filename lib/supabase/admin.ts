import "server-only";
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@/lib/supabase/config";

export function createAdminClient() {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const secret =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret?.trim()) {
    throw new Error(
      "Supabase server key is missing. Add SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) to .env.local."
    );
  }

  return createClient(url, secret.trim(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
