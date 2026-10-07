"use client";

import { useState } from "react";

export default function VoteButtons({ generationId }: { generationId: string }) {
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    async function submitVote(vote: "up" | "down") {
        setSaving(true);
        setError("");
        try {
            const response = await fetch("/api/votes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ generationId, vote }),
            });
            const data = await response.json();

            if (response.status === 409) {
                setSaved(true);
                setMessage("You have already rated these picks.");
                return;
            }
            if (!response.ok) {
                throw new Error(data.error || "Could not save vote.");
            }

            setSaved(true);
            setMessage(vote === "up" ? "Saved: Would try!" : "Saved: Skip.");
        } catch (error) {
            setError(error instanceof Error ? error.message : "Please try again.");
        } finally {
            setSaving(false);
        }
    }

    const buttonStyle = {
        border: "1px solid #999",
        borderRadius: 6,
        padding: "10px 16px",
        minWidth: 100,
    };

    return (
        <div style={{ marginTop: 20 }}>
            <div role="group" aria-label="Rate these picks"
                 style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button type="button" style={buttonStyle} disabled={saving || saved}
                        onClick={() => submitVote("up")}>Would try</button>
                <button type="button" style={buttonStyle} disabled={saving || saved}
                        onClick={() => submitVote("down")}>Skip</button>
            </div>
            <p role="status">{saving ? "Saving vote..." : message}</p>
            {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
        </div>
    );
}