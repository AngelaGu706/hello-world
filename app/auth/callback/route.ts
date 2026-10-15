import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const goTo = (path: string) => {
        const response = NextResponse.redirect(`${origin}${path}`);
        response.headers.set("Cache-Control", "private, no-store");
        return response;
    };

    if (code) {
        const supabase = await createClient();

        const { error } =
            await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) return goTo("/?auth_error=signin_failed");

            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("first_name, last_name")
                    .eq("id", user.id)
                    .single();

                if (
                    !profile?.first_name ||
                    !profile?.last_name
                ) {
                    return goTo("/profile");
                }
            }

            return goTo("/dashboard");
        }
    }

    return goTo("/?auth_error=signin_failed");
}
