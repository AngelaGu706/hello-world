"use client";

import { useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function LoginButton() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const busy = useRef(false);
    async function signInWithGoogle() {
        if (busy.current) return;
        busy.current = true;
        setLoading(true);
        setError("");
        try {
            const supabase = createClient();
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: `${window.location.origin}/auth/callback` },
            });
            if (error) throw error;
        } catch {
            setError("Couldn’t start sign-in. Please try again.");
            setLoading(false);
            busy.current = false;
        }
    }
    return <>
        <button type="button" onClick={signInWithGoogle} disabled={loading} className="google-signin" aria-busy={loading}>
            {loading ? <LoaderCircle size={18} className="is-spinning" aria-hidden="true" /> : <span className="google-mark" aria-hidden="true">G</span>}
            {loading ? "Connecting to Google…" : "Continue with Google"}
        </button>
        <div aria-live="polite">{error && <p role="alert" className="community-error">{error}</p>}</div>
    </>;
}
