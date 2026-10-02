import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "./env";

const LOGIN_PATH = "/login";

// Session refresh + route protection. Called from proxy.ts (Next.js 16 renamed
// the `middleware` file convention to `proxy`; this helper keeps the V1 file name).
export async function updateSession(request: NextRequest) {
  const { url, anonKey } = getSupabaseEnv();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() validates the token with Supabase Auth on every request.
  // Do not replace it with getSession() here: that only reads the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === LOGIN_PATH;

  if (!user && !isLoginPage) {
    return redirectTo(request, LOGIN_PATH, response);
  }

  if (user && isLoginPage) {
    return redirectTo(request, "/", response);
  }

  return response;
}

// Redirect while keeping any refreshed auth cookies from the original response.
function redirectTo(
  request: NextRequest,
  pathname: string,
  source: NextResponse,
) {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = "";

  const redirect = NextResponse.redirect(target);
  source.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
