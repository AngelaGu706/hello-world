"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, GraduationCap, LoaderCircle, MapPin, Moon, Sparkles, Utensils } from "lucide-react";
import LocationControl from "./location-control";
import PickContent from "./pick-content";
import VoteButtons from "./vote-buttons";
import PickCardHeader from "./pick-card-header";
import ReservationLink from "./reservation-link";

import type { Cuisine } from "@/utils/food-cuisines";
import CuisineSelector from "./cuisine-selector";
import NeighborhoodSelector from "./neighborhood-selector";
import type { Neighborhood } from "@/utils/food-neighborhoods";

type FoodPick = {
    id: string;
    prompt: string;
    title: string;
    content: string;
};

const quickPrompts: { label: string; prompt: string; neighborhood?: Neighborhood | ""; icon: typeof Moon }[] = [
    { label: "Late-night eats", prompt: "Budget-friendly late-night food near Columbia", neighborhood: "Morningside Heights", icon: Moon },
    { label: "Brunch under $30", prompt: "A cozy brunch spot in the West Village under $30", neighborhood: "West Village", icon: Utensils },
    { label: "After-class bites", prompt: "Somewhere to grab dumplings after class", icon: GraduationCap },
    { label: "Explore Queens", prompt: "Somewhere new to eat in Queens this weekend", neighborhood: "", icon: MapPin },
];

export default function FoodSpotsGenerator() {
    const [prompt, setPrompt] = useState("");
    const [cuisine, setCuisine] = useState<Cuisine | "">("");
    const [neighborhood, setNeighborhood] = useState<Neighborhood | "">("");
    const effectivePrompt = prompt.trim() || (cuisine || neighborhood ? `student-friendly ${cuisine ? `${cuisine} ` : ""}food in ${neighborhood || "NYC"}` : "");
    const [pick, setPick] = useState<FoodPick | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const requestInFlight = useRef(false);
    const resultRef = useRef<HTMLElement>(null);

    async function generate(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (requestInFlight.current || loading || effectivePrompt.length < 3) return;
        requestInFlight.current = true;

        setLoading(true);
        setError("");
        try {
            const response = await fetch("/api/food-spots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: effectivePrompt, ...(cuisine ? { cuisine } : {}), ...(neighborhood ? { neighborhood } : {}) }),
                cache: "no-store",
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Couldn’t find a spot. Please try again.");
            if (
                typeof data.id !== "string" || !data.id ||
                typeof data.prompt !== "string" ||
                typeof data.title !== "string" || !data.title.trim() ||
                typeof data.content !== "string" || !data.content.trim()
            ) throw new Error("Couldn’t load the pick. Please try again.");
            setPick(data);
            requestAnimationFrame(() => resultRef.current?.focus({ preventScroll: true }));
        } catch (error) {
            setError(error instanceof Error ? error.message : "Please try again.");
        } finally {
            setLoading(false);
            requestInFlight.current = false;
        }
    }

    return (
        <section className="pick-generator" aria-label="Find a food spot">
            <form onSubmit={generate}>
                <div className="generator-selectors">
                    <CuisineSelector value={cuisine} onChange={(value) => { setCuisine(value); setError(""); }}
                        label="Cuisine" groupLabel="Choose a cuisine" allLabel="Any cuisine" disabled={loading} />
                    <NeighborhoodSelector value={neighborhood} onChange={value => { setNeighborhood(value); setError(""); }} disabled={loading} />
                </div>
                <label htmlFor="food-prompt" className="generator-prompt-label">Any preferences?</label>
                <textarea id="food-prompt" value={prompt}
                    onChange={(event) => { setPrompt(event.target.value); setError(""); }}
                    aria-describedby="prompt-count" aria-invalid={!!error}
                    placeholder="Dish, neighborhood, budget…"
                    rows={2} maxLength={200} minLength={3} required={!cuisine && !neighborhood}
                    disabled={loading} className="generator-input" />
                <div className="generator-options">
                    <div className="generator-prompts" role="group" aria-label="Ideas to get you started">
                        {quickPrompts.map(({ label, prompt: quickPrompt, neighborhood: quickNeighborhood, icon: Icon }) => (
                            <button key={quickPrompt} type="button" disabled={loading}
                                aria-pressed={prompt === quickPrompt}
                                className={prompt === quickPrompt ? "is-selected" : ""}
                                onClick={() => { setPrompt(quickPrompt); if (quickNeighborhood !== undefined) setNeighborhood(quickNeighborhood); setError(""); }}>
                                <Icon size={15} aria-hidden="true" />{label}
                            </button>
                        ))}
                    </div>
                    <span id="prompt-count" className="generator-character-count" aria-label={`${prompt.length} of 200 characters`}>{prompt.length}/200</span>
                </div>
                <button type="submit" disabled={loading || effectivePrompt.length < 3} className="generator-submit">
                    {loading ? <LoaderCircle size={18} className="is-spinning" aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}
                    {loading ? "Finding a spot…" : "Find a spot"}
                </button>
                {loading && <p className="generator-loading" role="status">Finding something good for you...</p>}
                {error && <p role="alert" className="community-error">{error}</p>}
            </form>

            <LocationControl />
            <div aria-live="polite" aria-busy={loading}>
                {pick && (
                    <article key={pick.id} ref={resultRef} tabIndex={-1} aria-labelledby="generated-pick-title" className="generator-result community-pick community-feed-card editorial-pick-card">
                        <PickCardHeader pick={pick} />
                        <div className="pick-card-body">
                            <div className="generator-result-top">
                                <p className="generator-saved"><CheckCircle2 size={16} aria-hidden="true" />Shared with the community</p>
                                <Link href="/dashboard/picks">Community Picks<ArrowUpRight size={15} aria-hidden="true" /></Link>
                            </div>
                            <div className="community-title-row"><h2 id="generated-pick-title">{pick.title}</h2></div>
                            <PickContent generationId={pick.id} content={pick.content} prompt={pick.prompt} variant="community" showPrompt={false} />
                            <div className="community-card-footer">
                                {loading ? <ReservationLink pick={pick} compact /> : <VoteButtons generationId={pick.id} trailingAction={<ReservationLink pick={pick} compact />} />}
                            </div>
                            <details className="pick-original-prompt"><summary>More about this pick</summary><p>{pick.prompt}</p></details>
                        </div>
                    </article>
                )}
            </div>
        </section>
    );
}
