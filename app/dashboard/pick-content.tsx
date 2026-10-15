"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, MapPin, Utensils } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { decodePickContent, getPickCuisine } from "@/utils/food-pick";

export default function PickContent({ content, prompt, variant = "default" }: { content: string; prompt: string; variant?: "default" | "list" | "community" }) {
    const { area, food, recommendation, cuisine } = decodePickContent(content);
    const [expanded, setExpanded] = useState(false);
    const [long, setLong] = useState(false);
    const recommendationRef = useRef<HTMLDivElement>(null);
    const contentId = useId();
    const isList = variant === "list";
    const isCommunity = variant === "community";
    const listCuisine = cuisine ?? getPickCuisine({ title: "", content });
    const displayCuisine = isCommunity && listCuisine === "Other" ? null : listCuisine;
    const dish = recommendation.match(/\*\*([^*\n]+)\*\*/)?.[1]?.trim() || food;

    useEffect(() => {
        const element = recommendationRef.current;
        if (!element) return;

        // Measure the rendered text so short picks also expand on narrow screens.
        const measure = () => {
            const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
            setLong(element.scrollHeight > lineHeight * 3 + 1);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, [recommendation]);

    return (
        <div className="pick-content">
            {isList || isCommunity ? <>
                {(area || displayCuisine) && <div className="pick-metadata">
                    {displayCuisine && <span className="cuisine-badge">{displayCuisine}</span>}
                    {area && <span><MapPin size={14} aria-hidden="true" />{area}</span>}
                </div>}
                {dish && <p className={isCommunity ? "community-dish" : "bucket-dish"}><Utensils size={16} aria-hidden="true" /><span><span className={isCommunity ? "community-dish-label" : "bucket-dish-label"}>{isCommunity ? "ORDER THIS" : "Try"}</span><strong>{dish}</strong></span></p>}
            </> : (area || food || cuisine) && <div className="pick-metadata">
                {area && <span><MapPin size={14} aria-hidden="true" />{area}</span>}
                {cuisine && <span className="cuisine-badge">{cuisine}</span>}
                {food && <span><Utensils size={14} aria-hidden="true" />{food}</span>}
            </div>}
            <div ref={recommendationRef} id={contentId} className={`community-recommendation${!expanded ? " is-collapsed" : ""}`}>
                <ReactMarkdown>{recommendation}</ReactMarkdown>
            </div>
            {long && <button type="button" className="pick-expand" aria-expanded={expanded} aria-controls={contentId}
                onClick={() => setExpanded((value) => !value)}>
                {expanded ? "Show less" : "Read more"}<ChevronDown size={14} aria-hidden="true" className={expanded ? "is-expanded" : ""} />
            </button>}
            <details className="pick-original-prompt">
                <summary>Original prompt</summary>
                <p>{prompt}</p>
            </details>
        </div>
    );
}
