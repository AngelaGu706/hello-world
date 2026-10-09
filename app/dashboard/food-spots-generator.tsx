"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, GraduationCap, LoaderCircle, MapPin, Moon, Sparkles, Utensils } from "lucide-react";
import PickContent from "./pick-content";
import VoteButtons from "./vote-buttons";
import BookmarkButton from "./bookmark-button";

import type { Cuisine } from "@/utils/food-cuisines";
import CuisineSelector from "./cuisine-selector";

type FoodPick = {
    id: string;
    prompt: string;
    title: string;
    content: string;
};

const quickPrompts = [
    { label: "Late-night eats", prompt: "Budget-friendly late-night food near Columbia", icon: Moon },
    { label: "Brunch under $30", prompt: "A cozy brunch spot in the West Village under $30", icon: Utensils },
    { label: "After-class bites", prompt: "Somewhere to grab dumplings after class", icon: GraduationCap },
    { label: "Explore Queens", prompt: "Somewhere new to eat in Queens this weekend", icon: MapPin },
];

export default function FoodSpotsGenerator() {
    const [prompt, setPrompt] = useState("");
    const [cuisine, setCuisine] = useState<Cuisine | "">("");
    const effectivePrompt = prompt.trim() || (cuisine ? `student-friendly ${cuisine} food in NYC` : "");
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
                body: JSON.stringify({ prompt: effectivePrompt, ...(cuisine ? { cuisine } : {}) }),
                cache: "no-store",
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Couldn’t find a spot. Please try again.");
            if (
                typeof data.id !== "string" || !data.id ||
                typeof data.prompt !== "string" ||
                typeof data.title !== "string" || !data.title.trim() ||
                typeof data.content !== "string" || !data.content.trim()
            ) throw new Error("Couldn’t load your pick. Please try again.");
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
                <CuisineSelector value={cuisine} onChange={(value) => { setCuisine(value); setError(""); }}
                    label="Cuisine" groupLabel="Choose a cuisine" allLabel="Any cuisine" disabled={loading} />
                <label htmlFor="food-prompt" className="generator-prompt-label">Any preferences?</label>
                <p id="prompt-help" className="generator-hint">Add a dish, area, or budget.</p>
                <textarea id="food-prompt" value={prompt}
                    onChange={(event) => { setPrompt(event.target.value); setError(""); }}
                    aria-describedby="prompt-help prompt-count" aria-invalid={!!error}
                    placeholder={cuisine ? `e.g. ${cuisine} food under $20` : "e.g. Late-night food near Columbia"}
                    rows={2} maxLength={200} minLength={3} required={!cuisine}
                    disabled={loading} className="generator-input" />
                <div className="generator-options">
                    <div className="generator-prompts" role="group" aria-label="Ideas to get you started">
                        {quickPrompts.map(({ label, prompt: quickPrompt, icon: Icon }) => (
                            <button key={quickPrompt} type="button" disabled={loading}
                                aria-pressed={prompt === quickPrompt}
                                className={prompt === quickPrompt ? "is-selected" : ""}
                                onClick={() => { setPrompt(quickPrompt); setError(""); }}>
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
                {loading && <p className="generator-loading" role="status">This may take a moment.</p>}
                {error && <p role="alert" className="community-error">{error}</p>}
            </form>

            <div aria-live="polite" aria-busy={loading}>
                {pick && (
                    <article key={pick.id} ref={resultRef} tabIndex={-1} aria-labelledby="generated-pick-title" className="generator-result">
                        <div className="generator-result-top">
                            <p className="generator-saved"><CheckCircle2 size={16} aria-hidden="true" />Shared with the community</p>
                            <Link href="/dashboard/picks">Community Picks<ArrowUpRight size={15} aria-hidden="true" /></Link>
                        </div>
                        <h2 id="generated-pick-title">{pick.title}</h2>
                        <PickContent content={pick.content} prompt={pick.prompt} />
                        <p className="generator-result-note">Save it for later. Check hours and prices before you go.</p>
                        {!loading && <><VoteButtons generationId={pick.id} /><BookmarkButton generationId={pick.id} /></>}
                    </article>
                )}
            </div>
        </section>
    );
}
