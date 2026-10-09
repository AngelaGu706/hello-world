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
    { label: "Near Columbia", prompt: "cheap late-night food near Columbia", icon: Moon },
    { label: "Brunch under $30", prompt: "cozy brunch in West Village under $30", icon: Utensils },
    { label: "After class", prompt: "quick dumplings after class", icon: GraduationCap },
    { label: "Queens weekend", prompt: "weekend adventure food in Queens", icon: MapPin },
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
            if (!response.ok) throw new Error(data.error || "Generation failed.");
            if (
                typeof data.id !== "string" || !data.id ||
                typeof data.prompt !== "string" ||
                typeof data.title !== "string" || !data.title.trim() ||
                typeof data.content !== "string" || !data.content.trim()
            ) throw new Error("No saved pick returned.");
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
        <section className="pick-generator" aria-label="Generate a food pick">
            <form onSubmit={generate}>
                <CuisineSelector value={cuisine} onChange={(value) => { setCuisine(value); setError(""); }}
                    label="What cuisine are you craving?" groupLabel="Choose a cuisine" allLabel="Any cuisine" disabled={loading} />
                <label htmlFor="food-prompt" className="generator-prompt-label">Make it your kind of meal</label>
                <p id="prompt-help" className="generator-hint">Add a neighborhood, dish, or budget — or start with an idea below.</p>
                <textarea id="food-prompt" value={prompt}
                    onChange={(event) => { setPrompt(event.target.value); setError(""); }}
                    aria-describedby="prompt-help prompt-count" aria-invalid={!!error}
                    placeholder={cuisine ? `Any preferences for ${cuisine} food? Neighborhood, budget, or dish...` : "cheap late-night food near Columbia"}
                    rows={2} maxLength={200} minLength={3} required={!cuisine}
                    disabled={loading} className="generator-input" />
                <div className="generator-options">
                    <div className="generator-prompts" role="group" aria-label="Quick food prompts">
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
                    {loading ? "Finding your pick…" : "Generate a Pick"}
                </button>
                {loading && <p className="generator-loading" role="status">Looking for a good match. This may take a moment.</p>}
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
                        <p className="generator-result-note">Save this to your bucket list to keep it handy. Check current hours and prices before heading out.</p>
                        {!loading && <><VoteButtons generationId={pick.id} /><BookmarkButton generationId={pick.id} /></>}
                    </article>
                )}
            </div>
        </section>
    );
}
