import Image from "next/image";
import { Utensils } from "lucide-react";
import LoginButton from "./login-button";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function Home({ searchParams }: {
    searchParams: Promise<{ auth_error?: string }>;
}) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) redirect("/dashboard");
    const { auth_error: authError } = await searchParams;
    return (
        <main className="login-page">
            <div className="login-shell">
                <div className="login-story">
                    <Image src="/dashboard-pizza-hd.webp" alt="" fill sizes="(max-width: 700px) 100vw, 55vw" preload className="login-story-image" />
                </div>
                <section className="login-card" aria-labelledby="login-title">
                    <p className="community-wordmark"><Utensils size={22} aria-hidden="true" />NYC FOOD SPOTS</p>
                    <h1 id="login-title">Turn your cravings into your next spot.</h1>
                    <LoginButton signInFailed={!!authError} />
                </section>
            </div>
        </main>
    );
}
