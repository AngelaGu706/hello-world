import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/");
    }

    return (
        <main className="dashboard-page">
            <div className="dashboard-card">
                <div className="dashboard-emoji">🍽️</div>

                <p className="dashboard-label">NYC FOOD SPOTS</p>

                <h1>Welcome back.</h1>

                <p className="dashboard-email">
                    {user.email}
                </p>

                <Link href="/profile" className="profile-link">
                    Edit Profile
                </Link>

                <form action="/auth/signout" method="post">
                    <button className="signout-button" type="submit">
                        Sign out
                    </button>
                </form>
            </div>
        </main>
    );
}