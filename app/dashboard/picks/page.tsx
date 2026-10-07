"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import VoteButtons from "../vote-buttons";

type FoodPick = {
    id: string;
    title: string;
    content: string;
    myVote: "up" | "down" | null;
};

export default function PicksPage() {
    const [picks, setPicks] = useState<FoodPick[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        async function load() {
            try {
                const response = await fetch("/api/food-spots", {
                    cache: "no-store",
                    signal: controller.signal,
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "Could not load picks.");
                }
                if (!Array.isArray(data.generations)) {
                    throw new Error("Could not load picks.");
                }
                setPicks(data.generations);
            } catch (error) {
                if (!controller.signal.aborted) {
                    setError(error instanceof Error ? error.message : "Please try again.");
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        void load();
        return () => controller.abort();
    }, []);

    return (
        <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px" }}>
            <Link href="/dashboard">Back to Dashboard</Link>
            <h1>NYC Weekend Picks</h1>
            {loading && <p role="status">Loading picks...</p>}
            {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
            {!loading && !error && !picks.length && <p>No saved picks yet.</p>}
            {picks.map((pick) => (
                <article key={pick.id} style={{
                    padding: "24px 0", borderBottom: "1px solid #ddd",
                    overflowWrap: "anywhere", lineHeight: 1.7,
                }}>
                    <h2 style={{ fontSize: 22 }}>{pick.title}</h2>
                    <ReactMarkdown components={{
                        p: ({ children }) => (
                            <p style={{ margin: "0 0 16px", whiteSpace: "pre-line" }}>
                                {children}
                            </p>
                        ),
                    }}>{pick.content}</ReactMarkdown>
                    {pick.myVote ? (
                        <p>Your rating: {pick.myVote === "up" ? "Would try" : "Skip"}</p>
                    ) : <VoteButtons generationId={pick.id} />}
                </article>
            ))}
        </main>
    );
}