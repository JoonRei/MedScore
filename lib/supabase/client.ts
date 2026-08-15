"use client";

import { createBrowserClient } from "@supabase/ssr";
import { normalizeSupabaseUrl } from "@/lib/supabase/config";

export function createBrowserSupabaseClient() {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key?.trim()) {
    throw new Error(
      "Supabase public key is missing. Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) to .env.local."
    );
  }

  return createBrowserClient(url, key.trim());
}
