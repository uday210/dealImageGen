import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // Allow login page — but if user is already logged in and no forced reason, send home
  if (pathname === "/login") {
    if (user && !request.nextUrl.searchParams.get("reason")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return supabaseResponse;
  }

  // Require auth for everything else
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Single query: get role + status for both admin gate and active-session check
  const { data: profile } = await supabase
    .from("app_users")
    .select("role, is_enabled, valid_until")
    .eq("id", user.id)
    .single();

  // Account disabled — redirect to login with reason (login page will sign them out)
  if (!profile || !profile.is_enabled) {
    return NextResponse.redirect(new URL("/login?reason=disabled", request.url));
  }

  // Access expired
  if (profile.valid_until && new Date(profile.valid_until) < new Date()) {
    return NextResponse.redirect(new URL("/login?reason=expired", request.url));
  }

  // Gate /admin to admins only
  if (pathname.startsWith("/admin") && profile.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
