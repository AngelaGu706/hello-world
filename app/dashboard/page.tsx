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
        <main>
            <h1>Dashboard</h1>
            <p>You are logged in!</p>
            <p>{user.email}</p>

            <form action="/auth/signout" method="post">
                <button type="submit">Sign out</button>
            </form>
        </main>
    );
}