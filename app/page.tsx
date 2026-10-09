import Image from "next/image";
import { Bookmark, Compass, Sparkles, Utensils } from "lucide-react";
import LoginButton from "./login-button";

export default function Home() {
    return (
        <main className="login-page">
            <div className="login-shell">
                <div className="login-story">
                    <Image src="/dashboard-pizza-hd.webp" alt="A freshly baked pizza, ready to share" fill sizes="(max-width: 700px) 100vw, 55vw" preload className="login-story-image" />
                    <div className="login-story-content">
                        <p className="login-story-eyebrow">ONE CITY. SO MANY GOOD BITES.</p>
                        <h2>A new favorite<br />is around the corner.</h2>
                        <p>From a quick bite after class to a weekend in Queens.</p>
                    </div>
                </div>
                <section className="login-card" aria-labelledby="login-title">
                    <p className="community-wordmark"><Utensils size={22} aria-hidden="true" />NYC FOOD SPOTS</p>
                    <p className="login-label">YOUR NEXT NYC FOOD ADVENTURE</p>
                    <h1 id="login-title">Find your next<br />favorite bite.</h1>
                    <p className="login-description">Tell us what you’re craving. Discover a pick, explore the community, and keep a list of places to try.</p>
                    <ul className="login-features">
                        <li><Sparkles size={18} aria-hidden="true" /><span>Picks for your mood and budget</span></li>
                        <li><Compass size={18} aria-hidden="true" /><span>New neighborhoods to explore</span></li>
                        <li><Bookmark size={18} aria-hidden="true" /><span>Your own food bucket list</span></li>
                    </ul>
                    <LoginButton />
                    <p className="login-note">Sign in to discover, rate, and save your picks.</p>
                </section>
            </div>
        </main>
    );
}
