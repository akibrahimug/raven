import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSignedInUser } from "@/lib/supabase/claims";

const PUBLIC_PATHS = [/^\/login/, /^\/signup/, /^\/auth\/callback/, /^\/j\//];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the session if expired — required for server components.
  const user = await getSignedInUser(supabase);

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((re) => re.test(pathname));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    // New visitors land on signup; an existing session that's merely
    // expired still goes to /login — see the redirect() calls in actions.ts
    // that route an explicit sign-out there instead of here.
    url.pathname = "/signup";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Google and email sign-ups arrive without a phone number, but the number
  // is how a Raven account logs back in — until it's verified by SMS code,
  // /phone is the only page that opens.
  if (user && !user.phoneVerified && !isPublic && pathname !== "/phone") {
    const url = request.nextUrl.clone();
    url.pathname = "/phone";
    url.search = "";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    const redirect = NextResponse.redirect(url);
    // getSignedInUser() above may have just refreshed the session; a redirect that
    // dropped the new cookies would leave the browser holding a rotated-out
    // refresh token.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
