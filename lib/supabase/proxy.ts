import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "./env";

/** Refreshes the auth session cookie and sends logged-out visitors to /login. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getClaims — it can log users out randomly.
  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims);
  const onLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!loggedIn && !onLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (loggedIn && onLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}
