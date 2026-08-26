import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getGradeAdminUser() {
  const cookieStore = await cookies();
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!url || !key) return null;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(values: Array<{ name: string; value: string; options?: any }>) {
        try {
          for (const value of values) cookieStore.set(value.name, value.value, value.options);
        } catch {
          // Server Components may not be allowed to set cookies. API route auth
          // still works because getUser() only needs the incoming cookie values.
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
