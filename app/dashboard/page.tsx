import Link from "next/link";
import { ArrowRight, Bookmark, LogOut, UserRound, Utensils } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import FoodSpotsGenerator from "./food-spots-generator";
import Image from "next/image";

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) redirect("/");

    return (
        <main className="dashboard-page food-page">
            <nav className="dashboard-nav" aria-label="Discover navigation">
                <Link href="/dashboard" className="community-wordmark">
                    <Utensils size={22} aria-hidden="true" /><span>NYC FOOD SPOTS</span>
                </Link>
                <div className="dashboard-account">
                    <Link href="/dashboard/bucket-list" className="dashboard-bucket-link" title="Your List" aria-label="Your List">
                        <Bookmark size={18} aria-hidden="true" /><span>Your List</span>
                    </Link>
                    <Link href="/profile" className="dashboard-profile" title="Edit Profile" aria-label="Edit Profile">
                        <UserRound size={18} aria-hidden="true" /><span>Profile</span>
                    </Link>
                    <form action="/auth/signout" method="post">
                        <button type="submit" className="dashboard-signout" aria-label="Sign out" title="Sign out">
                            <LogOut size={18} aria-hidden="true" />
                        </button>
                    </form>
                </div>
            </nav>

            <div className="discover-banner" aria-hidden="true">
                <Image src="/dashboard-pizza-hd.webp" alt="" fill sizes="100vw" quality={90} preload />
            </div>

            <div className="dashboard-content">
                <header className="dashboard-heading">
                    <h1>Turn your cravings into your next spot.</h1>
                </header>
                <FoodSpotsGenerator />
                <Link href="/dashboard/picks" className="dashboard-community-link">
                    <h2>Community picks</h2>
                    <ArrowRight size={20} aria-hidden="true" />
                </Link>
            </div>
        </main>
    );
}
