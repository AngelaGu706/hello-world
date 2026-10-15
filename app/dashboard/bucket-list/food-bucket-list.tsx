"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Bookmark, Check, CheckCircle2, Compass, LoaderCircle, RefreshCw, Search, Utensils, X } from "lucide-react";
import PickContent from "../pick-content";
import { useBucketList, type BucketItem } from "../bucket-list-provider";
import { decodePickContent } from "@/utils/food-pick";
import { getReservationLink } from "@/utils/reservations";

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
    const reservation = getReservationLink(item.generation);
    return <article className={`community-pick bucket-card ${visited ? "is-visited" : ""}`}>
        <div className="community-pick-top">
            <span className={`bucket-status ${visited ? "is-visited" : ""}`}>
                {visited ? <CheckCircle2 size={14} aria-hidden="true" /> : <Bookmark size={14} aria-hidden="true" />}{visited ? "TRIED" : "SAVED"}
            </span>
            <button type="button" className="bucket-remove" disabled={busy} onClick={() => update("DELETE")} aria-label={`Remove ${item.generation.title} from the list`} title="Remove from the list"><X size={17} aria-hidden="true" /></button>
        </div>
        <h2>{item.generation.title}</h2>
        <PickContent content={item.generation.content} prompt={item.generation.prompt} variant="list" />
        <div className="bucket-card-actions">
            {!visited && <a className="bucket-reservation-link" href={reservation.href} target="_blank" rel="noopener noreferrer"
                aria-label={`${reservation.label} for ${item.generation.title} (opens in a new tab)`}
                title={`${reservation.destination} · opens in a new tab`}>
                {reservation.label}<ArrowUpRight size={15} aria-hidden="true" />
            </a>}
            <button type="button" className={`bucket-visit ${visited ? "is-visited" : ""}`} disabled={busy} onClick={() => update("PATCH")}>
                {busy ? <LoaderCircle size={16} className="is-spinning" aria-hidden="true" /> : visited ? <Compass size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                {busy ? "Saving..." : visited ? "Move to Saved" : "Mark as tried"}
            </button>
        </div>
        {error && <p role="alert" className="community-error">{error}</p>}
    </article>;
}

export default function FoodBucketList() {
    const { items, loading, error, busyIds, reload } = useBucketList();
    const [filter, setFilter] = useState<BucketItem["status"]>("want_to_go");
    const [search, setSearch] = useState("");
    const available = items.filter(item => item.generation);
    const visited = available.filter(item => item.status === "been_there").length;
    const wantToGo = available.length - visited;
    // Keep active search accessible if removing an item crosses the threshold.
    const showTools = available.length >= 6 || search.length > 0;
    const visible = available.filter(item => {
        if (item.status !== filter) return false;
        const pick = item.generation!;
        const { area, food, recommendation } = decodePickContent(pick.content);
        return `${pick.title} ${pick.prompt} ${area} ${food} ${recommendation}`.toLowerCase().includes(search.trim().toLowerCase());
    });

    return <main className="community-page bucket-page">
        <nav className="community-nav" aria-label="Your List navigation">
            <Link href="/dashboard" className="community-wordmark"><Utensils size={22} aria-hidden="true" /><span>NYC FOOD SPOTS</span></Link>
            <div className="community-nav-actions">
                <Link href="/dashboard" className="community-back"><ArrowLeft size={16} aria-hidden="true" />Dashboard</Link>
                <Link href="/dashboard/picks" className="community-create">Browse picks<ArrowUpRight size={16} aria-hidden="true" /></Link>
            </div>
        </nav>
        <div className="community-content">
            <header className="bucket-heading">
                <p className="bucket-eyebrow"><Bookmark size={16} aria-hidden="true" />NYC FOOD LIST</p>
                <h1>Your List</h1>
                <p>Save now. Try later.</p>
            </header>
            {!loading && !error && <p className="bucket-stats" aria-label={`${wantToGo} saved, ${visited} tried`}>
                <span>{wantToGo} saved</span><span aria-hidden="true">·</span><span>{visited} tried</span>
            </p>}
            <div className="community-toolbar bucket-toolbar">
                <div className="community-tabs" role="group" aria-label="Filter saved picks">
                    {([["want_to_go", "Saved"], ["been_there", "Tried"]] as const).map(([value, label]) =>
                        <button type="button" key={value} data-status={value} aria-pressed={filter === value} className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{label}</button>)}
                </div>
                {showTools && <div className="community-tools">
                    <label className="community-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search your list" placeholder="Search your list..." value={search} onChange={event => setSearch(event.target.value)} /></label>
                    <button type="button" className="community-refresh" disabled={loading || busyIds.size > 0} onClick={reload} aria-label="Refresh your list"><RefreshCw size={18} className={loading ? "is-spinning" : ""} aria-hidden="true" /></button>
                </div>}
            </div>
            <div className="community-list-label"><span>{filter === "want_to_go" ? "SAVED SPOTS" : "TRIED SPOTS"}</span><span>{!loading && !error ? `${visible.length} ${visible.length === 1 ? "spot" : "spots"}` : ""}</span></div>
            <div className="community-feed" aria-live="polite" aria-busy={loading}>
                {loading && <p className="community-state" role="status">Loading your list...</p>}
                {error && <div className="community-state"><p className="community-error" role="alert">{error}</p><button type="button" className="community-create" onClick={reload}>Try again</button></div>}
                {!loading && !error && !available.length && <div className="bucket-empty"><Bookmark size={36} aria-hidden="true" /><h2>Nothing saved yet</h2><p>Save a spot from Community Picks or recommendations to get started.</p><Link href="/dashboard/picks" className="community-create">Browse Community Picks<ArrowUpRight size={16} aria-hidden="true" /></Link></div>}
                {!loading && !error && available.length > 0 && !visible.length && <div className="community-state">
                    <h2>{search ? "No matching spots." : filter === "been_there" ? "No spots tried yet." : "You’ve tried every saved spot."}</h2>
                    {search ? <button type="button" className="community-clear" onClick={() => setSearch("")}>Clear search</button>
                        : filter === "been_there" ? <button type="button" className="community-clear" onClick={() => setFilter("want_to_go")}>View saved spots</button>
                        : <Link href="/dashboard/picks" className="community-create">Find another spot<ArrowUpRight size={16} aria-hidden="true" /></Link>}
                </div>}
                {!loading && !error && visible.map(item => <BucketCard key={item.generation_id} item={item} />)}
            </div>
            <footer className="community-footer"><Utensils size={16} aria-hidden="true" /><span>NYC FOOD SPOTS</span><Link href="/dashboard">Find a place to try<ArrowUpRight size={14} aria-hidden="true" /></Link></footer>
        </div>
    </main>;
}
