"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, MapPin, Utensils } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { decodePickContent, getPickCuisine } from "@/utils/food-pick";

export default function PickContent({ content, prompt, variant = "default" }: { content: string; prompt: string; variant?: "default" | "list" }) {
    const { area, food, recommendation, cuisine } = decodePickContent(content);
    const [expanded, setExpanded] = useState(false);
    const [long, setLong] = useState(false);
    const recommendationRef = useRef<HTMLDivElement>(null);
    const contentId = useId();
    const isList = variant === "list";
    const listCuisine = cuisine ?? getPickCuisine({ title: "", content });
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
            {isList ? <>
                {(area || listCuisine) && <div className="pick-metadata">
                    {listCuisine && <span className="cuisine-badge">{listCuisine}</span>}
                    {area && <span><MapPin size={14} aria-hidden="true" />{area}</span>}
                </div>}
                {dish && <p className="bucket-dish"><Utensils size={16} aria-hidden="true" /><span><span className="bucket-dish-label">Try</span><strong>{dish}</strong></span></p>}
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
