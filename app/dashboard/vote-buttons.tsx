"use client";

import { useState, type ReactNode } from "react";
import { Check, ThumbsDown, ThumbsUp } from "lucide-react";

export type PickRating = {
    myVote: "up" | "down" | null;
    upCount: number | null;
    downCount: number | null;
};

type VoteButtonsProps = {
    generationId: string;
    initialVote?: PickRating["myVote"];
    upCount?: number | null;
    downCount?: number | null;
    onRated?: (rating: PickRating) => void;
    trailingAction?: ReactNode;
};

export default function VoteButtons({
    generationId, initialVote = null, upCount = null, downCount = null, onRated, trailingAction,
}: VoteButtonsProps) {
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(Boolean(initialVote));
    const [rating, setRating] = useState<PickRating>({ myVote: initialVote, upCount, downCount });
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    async function submitVote(vote: "up" | "down") {
        if (saving || saved) return;
        setSaving(true);
        setError("");
        try {
            const response = await fetch("/api/votes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ generationId, vote }),
            });
            const data = await response.json();

            if (!response.ok && response.status !== 409) {
                throw new Error(data.error || "Could not save vote.");
            }

            setSaved(true);
            if (data.rating) {
                setRating(data.rating);
                onRated?.(data.rating);
                setMessage(response.status === 409 ? "You have already rated this pick." : "Rating saved.");
            } else {
                const nextRating: PickRating = {
                    myVote: response.status === 409 ? rating.myVote : vote,
                    upCount: null,
                    downCount: null,
                };
                setRating(nextRating);
                onRated?.(nextRating);
                setMessage(response.status === 409
                    ? "Already rated. Refresh to see the rating."
                    : "Rating saved. Community totals are unavailable.");
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : "Please try again.");
        } finally {
            setSaving(false);
        }
    }

    const totalsAvailable = rating.upCount !== null && rating.downCount !== null;
    const total = (rating.upCount ?? 0) + (rating.downCount ?? 0);

    return (
        <div className="pick-ratings">
            <div className="rating-row">
                <div role="group" aria-label="Rate this pick" className="rating-buttons">
                    <button type="button"
                        className={`rating-button rating-up ${rating.myVote === "up" ? "is-selected" : ""}`}
                        disabled={saving || saved} aria-pressed={rating.myVote === "up"}
                        onClick={() => submitVote("up")}>
                        <ThumbsUp size={16} aria-hidden="true" />
                        <span>Would try</span><span className="rating-count">{rating.upCount ?? "--"}</span>
                        {rating.myVote === "up" && <Check size={14} className="rating-check" aria-hidden="true" />}
                    </button>
                    <button type="button"
                        className={`rating-button rating-down ${rating.myVote === "down" ? "is-selected" : ""}`}
                        disabled={saving || saved} aria-pressed={rating.myVote === "down"}
                        onClick={() => submitVote("down")}>
                        <ThumbsDown size={16} aria-hidden="true" />
                        <span>Skip</span><span className="rating-count">{rating.downCount ?? "--"}</span>
                        {rating.myVote === "down" && <Check size={14} className="rating-check" aria-hidden="true" />}
                    </button>
                </div>
                {trailingAction}
            </div>
            <span className="rating-summary">
                {!totalsAvailable ? "Rating totals unavailable" : total ? `${Math.round((rating.upCount ?? 0) / total * 100)}% would try · ${total} ${total === 1 ? "rating" : "ratings"}` : "Not rated yet"}
            </span>
            {(saving || message || rating.myVote) && <p role="status" className="rating-status">
                {saving ? "Saving..." : message || `You rated this: ${rating.myVote === "up" ? "Would try" : "Skip"}`}
            </p>}
            {error && <p role="alert" className="community-error">{error}</p>}
        </div>
    );
}
