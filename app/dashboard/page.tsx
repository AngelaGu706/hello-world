import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bookmark, LogOut, UserRound, Utensils } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import FoodSpotsGenerator from "./food-spots-generator";

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) redirect("/");

    return (
        <main className="dashboard-page">
            <nav className="dashboard-nav" aria-label="Dashboard navigation">
                <Link href="/dashboard" className="community-wordmark">
                    <Utensils size={22} aria-hidden="true" /><span>NYC FOOD SPOTS</span>
                </Link>
                <div className="dashboard-account">
                    <Link href="/dashboard/bucket-list" className="dashboard-bucket-link" title="My Bucket List" aria-label="My Bucket List">
                        <Bookmark size={18} aria-hidden="true" /><span>My Bucket List</span>
                    </Link>
                    <span className="dashboard-email" title={user.email}>{user.email}</span>
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

            <div className="dashboard-banner">
                <Image src="/dashboard-pizza-hd.webp" alt="" fill sizes="100vw" quality={90} preload className="dashboard-banner-image" />
                <div className="dashboard-hero-copy">
                    <p>GOOD FOOD. A LITTLE ADVENTURE.</p>
                    <h2>Your next favorite bite<br />starts here.</h2>
                </div>
            </div>

            <div className="dashboard-content">
                <header className="dashboard-heading">
                    <p className="section-eyebrow">LET YOUR CRAVINGS LEAD</p>
                    <h1>What sounds good today?</h1>
                    <p>Choose a cuisine or tell us your neighborhood, budget, and mood.</p>
                </header>
                <FoodSpotsGenerator />
                <Link href="/dashboard/picks" className="dashboard-community-link">
                    <div><h2>Explore Community Picks</h2><p>See what’s catching everyone’s eye around NYC.</p></div>
                    <ArrowRight size={20} aria-hidden="true" />
                </Link>
            </div>
        </main>
    );
}
