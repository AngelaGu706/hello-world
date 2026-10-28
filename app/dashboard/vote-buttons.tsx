"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
import { isPickRating, type PickRating } from "@/utils/generation-ratings";

export type { PickRating } from "@/utils/generation-ratings";

type VoteButtonsProps = {
    generationId: string;
    initialVote?: PickRating["myVote"];
    upCount?: number | null;
    downCount?: number | null;
    onRated?: (rating: PickRating) => void;
    trailingAction?: ReactNode;
};

// Reset state if this component is reused for a different generation.
export default function VoteButtons(props: VoteButtonsProps) {
    return <RatingControls key={props.generationId} {...props} />;
}

function RatingControls({
    generationId, initialVote = null, upCount = null, downCount = null, onRated, trailingAction,
}: VoteButtonsProps) {
    const [saving, setSaving] = useState(false);
    const [rating, setRating] = useState<PickRating>({ myVote: initialVote, upCount, downCount });
    const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
        upCount === null || downCount === null ? "loading" : "ready",
    );
    const [retry, setRetry] = useState(0);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const savingRef = useRef(false);
    const onRatedRef = useRef(onRated);
    const hasInitialTotals = useRef(upCount !== null && downCount !== null);
    useEffect(() => { onRatedRef.current = onRated; }, [onRated]);

    useEffect(() => {
        if (retry === 0 && hasInitialTotals.current) return;
        const controller = new AbortController();
        async function load() {
            try {
                const response = await fetch(`/api/votes?generationId=${encodeURIComponent(generationId)}`, {
                    cache: "no-store", signal: controller.signal,
                });
                const data = await response.json();
                if (controller.signal.aborted) return;
                if (isPickRating(data.rating)) {
                    setRating(data.rating);
                    onRatedRef.current?.(data.rating);
                }
                if (!response.ok || !isPickRating(data.rating)
                    || data.rating.upCount === null || data.rating.downCount === null) {
                    throw new Error(data.error || data.ratingsError || "Couldn't load ratings. Please try again.");
                }
                setLoadState("ready");
            } catch (error) {
                if (!controller.signal.aborted) {
                    setLoadState("error");
                    setError(error instanceof Error ? error.message : "Couldn't load ratings. Please try again.");
                }
            }
        }
        void load();
        return () => controller.abort();
    }, [generationId, retry]);

    function retryRatings() {
        setError("");
        setLoadState("loading");
        setRetry(version => version + 1);
    }

    async function submitVote(vote: "up" | "down") {
        if (savingRef.current || loadState !== "ready") return;
        const remove = rating.myVote === vote;
        savingRef.current = true;
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const response = await fetch("/api/votes", {
                method: remove ? "DELETE" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ generationId, ...(remove ? {} : { vote }) }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Couldn't save rating. Please try again.");
            }

            const nextRating: PickRating = isPickRating(data.rating) ? data.rating : {
                myVote: remove ? null : vote, upCount: null, downCount: null,
            };
            setRating(nextRating);
            onRated?.(nextRating);
            setMessage(remove ? "Rating removed" : "Community rating saved");
            const totalsMissing = nextRating.upCount === null || nextRating.downCount === null;
            setLoadState(totalsMissing ? "error" : "ready");
            if (totalsMissing) setError("Couldn't load ratings. Please try again.");
        } catch (error) {
            setError(error instanceof Error ? error.message : "Couldn't save rating. Please try again.");
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    }

    const totalsAvailable = rating.upCount !== null && rating.downCount !== null;
    const total = (rating.upCount ?? 0) + (rating.downCount ?? 0);

    return (
        <div className="pick-ratings" aria-busy={saving || loadState === "loading"}>
            <div className="rating-row">
                <div role="group" aria-label="Rate this pick" className="rating-buttons">
                    <button type="button"
                        className={`rating-button rating-up ${rating.myVote === "up" ? "is-selected" : ""}`}
                        disabled={saving || loadState !== "ready"} aria-pressed={rating.myVote === "up"}
                        title={rating.myVote === "up" ? "Click again to undo your rating" : "Rate: Would try"}
                        onClick={() => submitVote("up")}>
                        <ThumbsUp size={16} aria-hidden="true" />
                        <span>Would try</span><span className="rating-count">{rating.upCount ?? "--"}</span>
                        {rating.myVote === "up" && <Check size={14} className="rating-check" aria-hidden="true" />}
                    </button>
                    <button type="button"
                        className={`rating-button rating-down ${rating.myVote === "down" ? "is-selected" : ""}`}
                        disabled={saving || loadState !== "ready"} aria-pressed={rating.myVote === "down"}
                        title={rating.myVote === "down" ? "Click again to undo your rating" : "Rate: Skip"}
                        onClick={() => submitVote("down")}>
                        <ThumbsDown size={16} aria-hidden="true" />
                        <span>Skip</span><span className="rating-count">{rating.downCount ?? "--"}</span>
                        {rating.myVote === "down" && <Check size={14} className="rating-check" aria-hidden="true" />}
                    </button>
                </div>
                {trailingAction}
            </div>
            <span className={loadState === "ready" && totalsAvailable && total === 0 ? "sr-only" : "rating-summary"} role="status">
                {loadState === "loading" ? "Loading ratings..." : !totalsAvailable ? "Ratings couldn't be loaded"
                    : total ? `${Math.round((rating.upCount ?? 0) / total * 100)}% would try · ${total} ${total === 1 ? "rating" : "ratings"}` : "Not rated yet"}
            </span>
            {(saving || message || rating.myVote) && <p role="status" className={saving ? "rating-status" : "sr-only"}>
                {saving ? "Saving..." : message || `You rated this: ${rating.myVote === "up" ? "Would try" : "Skip"}`}
            </p>}
            {error && <p role="alert" className="community-error">{error}</p>}
            {loadState === "error" && <button type="button" className="community-clear" onClick={retryRatings} disabled={saving}>Retry ratings</button>}
        </div>
    );
}
