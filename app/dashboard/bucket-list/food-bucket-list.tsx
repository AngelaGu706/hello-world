"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Bookmark, Check, CheckCircle2, Compass, LoaderCircle, RefreshCw, Search, Utensils, X } from "lucide-react";
import PickContent from "../pick-content";
import { useBucketList, type BucketItem } from "../bucket-list-provider";
import { decodePickContent } from "@/utils/food-pick";

function BucketCard({ item }: { item: BucketItem }) {
    const { busyIds, change } = useBucketList();
    const [error, setError] = useState("");
    const busy = busyIds.has(item.generation_id);
    const visited = item.status === "been_there";
    async function update(method: "PATCH" | "DELETE") {
        setError("");
        try { await change(item.generation_id, method, visited ? "want_to_go" : "been_there"); }
        catch (error) { setError(error instanceof Error ? error.message : "Please try again."); }
    }
    if (!item.generation) return null;
    return <article className={`community-pick bucket-card ${visited ? "is-visited" : ""}`}>
        <div className="community-pick-top">
            <span className={`bucket-status ${visited ? "is-visited" : ""}`}>
                {visited ? <CheckCircle2 size={14} aria-hidden="true" /> : <Bookmark size={14} aria-hidden="true" />}{visited ? "BEEN THERE" : "WANT TO GO"}
            </span>
            <button type="button" className="bucket-remove" disabled={busy} onClick={() => update("DELETE")} aria-label={`Remove ${item.generation.title} from your list`} title="Remove from your list"><X size={17} aria-hidden="true" /></button>
        </div>
        <h2>{item.generation.title}</h2>
        <PickContent content={item.generation.content} prompt={item.generation.prompt} />
        <button type="button" className={`bucket-visit ${visited ? "is-visited" : ""}`} disabled={busy} onClick={() => update("PATCH")}>
            {busy ? <LoaderCircle size={16} className="is-spinning" aria-hidden="true" /> : visited ? <Compass size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
            {busy ? "Saving..." : visited ? "Undo visit" : "Mark as visited"}
        </button>
        {error && <p role="alert" className="community-error">{error}</p>}
    </article>;
}

export default function FoodBucketList() {
    const { items, loading, error, busyIds, reload } = useBucketList();
    const [filter, setFilter] = useState<"all" | BucketItem["status"]>("all");
    const [search, setSearch] = useState("");
    const available = items.filter(item => item.generation);
    const visited = available.filter(item => item.status === "been_there").length;
    const wantToGo = available.length - visited;
    const visible = available.filter(item => {
        if (filter !== "all" && item.status !== filter) return false;
        const pick = item.generation!;
        const { area, food, recommendation } = decodePickContent(pick.content);
        return `${pick.title} ${pick.prompt} ${area} ${food} ${recommendation}`.toLowerCase().includes(search.trim().toLowerCase());
    });

    return <main className="community-page bucket-page">
        <nav className="community-nav" aria-label="Bucket list navigation">
            <Link href="/dashboard" className="community-wordmark"><Utensils size={22} aria-hidden="true" /><span>NYC FOOD SPOTS</span></Link>
            <div className="community-nav-actions">
                <Link href="/dashboard" className="community-back"><ArrowLeft size={16} aria-hidden="true" />Dashboard</Link>
                <Link href="/dashboard/picks" className="community-create">Browse picks<ArrowUpRight size={16} aria-hidden="true" /></Link>
            </div>
        </nav>
        <div className="community-content">
            <header className="bucket-heading">
                <p className="bucket-eyebrow"><Bookmark size={16} aria-hidden="true" />YOUR NYC FOOD LIST</p>
                <h1>Your Food Bucket List</h1>
                <p>Save the spots you want to try. Check them off as you go.</p>
            </header>
            {!loading && !error && <div className="bucket-stats" aria-label="Your bucket list progress">
                <div className="bucket-stat-wanted"><Bookmark size={20} aria-hidden="true" /><strong>{wantToGo}</strong><span>Want to go</span></div>
                <div className="bucket-stat-visited"><CheckCircle2 size={20} aria-hidden="true" /><strong>{visited}</strong><span>Been there</span></div>
                <p>{visited > 0 ? `You’ve tried ${visited} ${visited === 1 ? "spot" : "spots"}. What’s next?` : available.length ? "Pick a spot for your next meal." : "Save a spot to get started."}</p>
            </div>}
            <div className="community-toolbar bucket-toolbar">
                <div className="community-tabs" role="group" aria-label="Filter saved picks">
                    {([["all", "All"], ["want_to_go", "Want to go"], ["been_there", "Been there"]] as const).map(([value, label]) =>
                        <button type="button" key={value} data-status={value} aria-pressed={filter === value} className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{label}</button>)}
                </div>
                <div className="community-tools">
                    <label className="community-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search your bucket list" placeholder="Search your list..." value={search} onChange={event => setSearch(event.target.value)} /></label>
                    <button type="button" className="community-refresh" disabled={loading || busyIds.size > 0} onClick={reload} aria-label="Refresh your bucket list"><RefreshCw size={18} className={loading ? "is-spinning" : ""} aria-hidden="true" /></button>
                </div>
            </div>
            <div className="community-list-label"><span>YOUR SAVED PICKS</span><span>{!loading && !error ? `${visible.length} saved ${visible.length === 1 ? "pick" : "picks"}` : ""}</span></div>
            <div className="community-feed" aria-live="polite" aria-busy={loading}>
                {loading && <p className="community-state" role="status">Loading your list...</p>}
                {error && <div className="community-state"><p className="community-error" role="alert">{error}</p><button type="button" className="community-create" onClick={reload}>Try again</button></div>}
                {!loading && !error && !available.length && <div className="bucket-empty"><Bookmark size={36} aria-hidden="true" /><h2>Nothing saved yet</h2><p>See a spot you like? Save it from Community Picks or your recommendations, and it&apos;ll show up here.</p><Link href="/dashboard/picks" className="community-create">Browse Community Picks<ArrowUpRight size={16} aria-hidden="true" /></Link></div>}
                {!loading && !error && available.length > 0 && !visible.length && <div className="community-state"><h2>{search ? "No picks match your search." : filter === "been_there" ? "You haven’t checked off any spots yet." : "You’ve tried everything on your list."}</h2><button type="button" className="community-clear" onClick={() => { setSearch(""); setFilter("all"); }}>Show all saved picks</button></div>}
                {!loading && !error && visible.map(item => <BucketCard key={item.generation_id} item={item} />)}
            </div>
            <footer className="community-footer"><Utensils size={16} aria-hidden="true" /><span>NYC FOOD SPOTS</span><Link href="/dashboard">Find a place to try<ArrowUpRight size={14} aria-hidden="true" /></Link></footer>
        </div>
    </main>;
}
