import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request });
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll: () => request.cookies.getAll(),
                setAll(cookiesToSet) {
                    // Both the current server render and the next browser request
                    // must receive the refreshed session.
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
                },
            },
        }
    );
    const { data } = await supabase.auth.getClaims();
    const path = request.nextUrl.pathname;
    const protectedPage = path === "/dashboard" || path.startsWith("/dashboard/") || path === "/profile";

    if (!data?.claims && protectedPage) {
        const target = request.nextUrl.clone();
        target.pathname = "/";
        target.search = "";
        const redirect = NextResponse.redirect(target);
        response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
        response = redirect;
    }

    response.headers.set("Cache-Control", "private, no-store");
    return response;
}

export const config = {
    matcher: ["/", "/dashboard/:path*", "/profile", "/api/:path*"],
};
