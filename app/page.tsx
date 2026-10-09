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
                        <h2>Good food.<br />New places.</h2>
                    </div>
                </div>
                <section className="login-card" aria-labelledby="login-title">
                    <p className="community-wordmark"><Utensils size={22} aria-hidden="true" />NYC FOOD SPOTS</p>
                    <h1 id="login-title">Where to eat next?</h1>
                    <ul className="login-features">
                        <li><Sparkles size={18} aria-hidden="true" /><span>Find a place</span></li>
                        <li><Compass size={18} aria-hidden="true" /><span>Explore local picks</span></li>
                        <li><Bookmark size={18} aria-hidden="true" /><span>Save for later</span></li>
                    </ul>
                    <LoginButton />
                </section>
            </div>
        </main>
    );
}
