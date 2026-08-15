import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicSupabaseConfig } from "@/lib/supabase/config";

const STUDENT_COOKIE = "medscores_student_session";

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie.name, cookie.value));
  return target;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  // Student pages receive a fast cookie gate here. The student layout performs
  // the authoritative database-backed session validation before rendering.
  if (pathname.startsWith("/student") && !request.cookies.get(STUDENT_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  let config: { url: string; key: string };
  try {
    config = publicSupabaseConfig();
  } catch {
    // Keep login/configuration screens reachable while environment variables
    // are being configured. Protected layouts still refuse unauthenticated access.
    return response;
  }

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const hasAdminSession = Boolean(data?.claims);

  // Admin pages are blocked at the request boundary and then validated again
  // by requireAdmin() inside the protected server layout.
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !hasAdminSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return copyResponseCookies(response, NextResponse.redirect(url));
  }

  return response;
}
