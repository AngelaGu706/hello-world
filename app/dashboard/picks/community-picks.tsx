"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Bookmark, Clock3, Plus, RefreshCw, Search, ThumbsUp, Utensils } from "lucide-react";
import PickContent from "../pick-content";
import BookmarkButton from "../bookmark-button";
import type { Cuisine } from "@/utils/food-cuisines";
import CuisineSelector from "../cuisine-selector";
import { decodePickContent, getPickCuisine } from "@/utils/food-pick";
import { uniqueLatestPicks } from "@/utils/community-picks";
import VoteButtons, { type PickRating } from "../vote-buttons";

type FoodPick = PickRating & {
    id: string;
    prompt: string;
    title: string;
    content: string;
    created_at: string;
};

function PickTime({ value }: { value: string }) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return <time dateTime={value}>{new Intl.DateTimeFormat("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    }).format(date)}</time>;
}

export default function CommunityPicks() {
    const router = useRouter();
    const [picks, setPicks] = useState<FoodPick[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [requestVersion, setRequestVersion] = useState(0);
    const [search, setSearch] = useState("");
    const [cuisine, setCuisine] = useState<Cuisine | "">("");
    const [sort, setSort] = useState<"latest" | "popular">("latest");

    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            try {
                const response = await fetch("/api/food-spots", { cache: "no-store", signal: controller.signal });
                if (response.status === 401) {
                    router.replace("/");
                    return;
                }
                const data = await response.json();
                if (!response.ok || !Array.isArray(data.generations)) {
                    throw new Error(data.error || "Could not load community picks.");
                }
                if (!controller.signal.aborted) setPicks(data.generations);
            } catch (error) {
                if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Please try again.");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        void load();
        return () => controller.abort();
    }, [requestVersion, router]);

    function reload() {
        setError("");
        setLoading(true);
        setRequestVersion((version) => version + 1);
    }

    function updateRating(id: string, rating: PickRating) {
        setPicks((current) => current.map((pick) => pick.id === id ? { ...pick, ...rating } : pick));
    }

    const query = search.trim().toLowerCase();
    const communityPicks = uniqueLatestPicks(picks);
    const visiblePicks = communityPicks
        .filter((pick) => !cuisine || getPickCuisine(pick) === cuisine)
        .filter((pick) => {
            const { area, food, recommendation } = decodePickContent(pick.content);
            return `${pick.title} ${pick.prompt} ${area} ${food} ${recommendation}`.toLowerCase().includes(query);
        })
        .sort((a, b) => sort === "popular"
            ? (b.upCount ?? 0) - (a.upCount ?? 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const totalsAvailable = communityPicks.every((pick) => pick.upCount !== null && pick.downCount !== null);
    const totalRatings = communityPicks.reduce((total, pick) => total + (pick.upCount ?? 0) + (pick.downCount ?? 0), 0);

    return (
        <main className="community-page">
            <nav className="community-nav" aria-label="Community navigation">
                <Link href="/dashboard" className="community-wordmark"><Utensils size={22} aria-hidden="true" /><span>NYC FOOD SPOTS</span></Link>
                <div className="community-nav-actions">
                    <Link href="/dashboard/bucket-list" className="community-back"><Bookmark size={16} aria-hidden="true" />Bucket List</Link>
                    <Link href="/dashboard" className="community-back community-dashboard-link"><ArrowLeft size={16} aria-hidden="true" />Dashboard</Link>
                    <Link href="/dashboard" className="community-create"><Plus size={16} aria-hidden="true" />Generate a Pick</Link>
                </div>
            </nav>

            <header className="community-cover">
                <Image src="/community-street-food.webp" alt="" fill sizes="100vw" preload className="community-cover-image" />
                <div className="community-cover-content">
                    <p className="community-eyebrow">FROM THE COMMUNITY</p>
                    <h1>Community Picks</h1>
                    <p className="community-cover-subtitle">Good food. New neighborhoods. More spots to try.</p>
                </div>
            </header>

            <div className="community-content">
                <div className="community-overview">
                    <div><span className="community-live-dot" aria-hidden="true" /><span>Fresh from NYC</span></div>
                    {!loading && !error && <p>{communityPicks.length} picks {totalsAvailable && <><span aria-hidden="true">/</span> {totalRatings} community ratings</>}</p>}
                </div>
                <div className="community-toolbar">
                    <div className="community-tabs" role="group" aria-label="Sort picks">
                        <button type="button" aria-pressed={sort === "latest"} className={sort === "latest" ? "is-active" : ""} onClick={() => setSort("latest")}><Clock3 size={15} aria-hidden="true" />Latest</button>
                        <button type="button" disabled={loading || !totalsAvailable} aria-pressed={sort === "popular"} className={sort === "popular" ? "is-active" : ""} onClick={() => setSort("popular")}><ThumbsUp size={15} aria-hidden="true" />Most liked</button>
                    </div>
                    <div className="community-tools">
                        <label className="community-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search the latest 20 picks" placeholder="Search picks..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
                        <button type="button" className="community-refresh" onClick={reload} disabled={loading} title="Refresh picks" aria-label="Refresh picks"><RefreshCw size={18} aria-hidden="true" className={loading ? "is-spinning" : ""} /></button>
                    </div>
                </div>
                <CuisineSelector value={cuisine} onChange={setCuisine} label="Explore by cuisine"
                    groupLabel="Filter picks by cuisine" allLabel="All cuisines" className="community-cuisines" />
                <div className="community-list-label"><span>THE LATEST 20 PICKS</span><span>{!loading && !error ? `${visiblePicks.length} shown` : ""}</span></div>

                <div className="community-feed" aria-live="polite" aria-busy={loading}>
                    {loading && <p role="status" className="community-state">Loading community picks...</p>}
                    {error && <div className="community-state"><p role="alert" className="community-error">{error}</p><button type="button" className="community-create" onClick={reload}>Try again</button></div>}
                    {!loading && !error && !picks.length && <div className="community-state"><h2>No picks yet.</h2><Link href="/dashboard" className="community-create">Generate a Pick<ArrowUpRight size={16} aria-hidden="true" /></Link></div>}
                    {!loading && !error && picks.length > 0 && !visiblePicks.length && <div className="community-state"><h2>No matching picks.</h2><button type="button" className="community-clear" onClick={() => { setSearch(""); setCuisine(""); }}>Clear filters</button></div>}
                    {!loading && !error && visiblePicks.map((pick) => (
                        <article key={pick.id} className="community-pick">
                            <div className="community-pick-top"><span className="community-pick-label"><Utensils size={14} aria-hidden="true" />FOOD PICK</span><p className="community-time"><PickTime value={pick.created_at} /></p></div>
                            <h2>{pick.title}</h2>
                            <PickContent content={pick.content} prompt={pick.prompt} />
                            <VoteButtons generationId={pick.id} initialVote={pick.myVote} upCount={pick.upCount} downCount={pick.downCount} onRated={(rating) => updateRating(pick.id, rating)} />
                            <BookmarkButton generationId={pick.id} />
                        </article>
                    ))}
                </div>
                <footer className="community-footer"><Utensils size={16} aria-hidden="true" /><span>NYC FOOD SPOTS</span><Link href="/dashboard">Find a spot<ArrowUpRight size={14} aria-hidden="true" /></Link></footer>
            </div>
        </main>
    );
}
