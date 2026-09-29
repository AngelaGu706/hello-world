"use client";

import { createClient } from "@/utils/supabase/client";

export default function LoginButton() {
    const signInWithGoogle = async () => {
        const supabase = createClient();

        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    return (
        <button onClick={signInWithGoogle}>
            Sign in with Google
        </button>
    );
}