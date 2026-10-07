"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import VoteButtons from "./vote-buttons";

export default function FoodSpotsGenerator() {
    const [text, setText] = useState("");
    const [generationId, setGenerationId] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function generate() {
        setLoading(true);
        setError("");
        try {
            const response = await fetch("/api/food-spots", {
                method: "POST",
                cache: "no-store",
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Generation failed.");
            }
            if (
                typeof data.text !== "string" || !data.text.trim() ||
                typeof data.id !== "string" || !data.id
            ) {
                throw new Error("No saved recommendations returned.");
            }

            setText(data.text);
            setGenerationId(data.id);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <section style={{ marginTop: 24 }}>
            <button type="button" onClick={generate} disabled={loading}
                    style={{
                        background: "#171717", color: "#fff", border: 0,
                        borderRadius: 6, padding: "12px 20px", minWidth: 200,
                        cursor: loading ? "wait" : "pointer",
                    }}>
                {loading ? "Generating..." : "Generate Food Spots"}
            </button>
            {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
            <div aria-live="polite" aria-busy={loading}>
                {text && (
                    <div style={{
                        marginTop: 20, textAlign: "left",
                        lineHeight: 1.7, overflowWrap: "anywhere",
                    }}>
                        <ReactMarkdown components={{
                            p: ({ children }) => (
                                <p style={{ margin: "0 0 20px", whiteSpace: "pre-line" }}>
                                    {children}
                                </p>
                            ),
                        }}>{text}</ReactMarkdown>
                    </div>
                )}
            </div>
            {!loading && generationId && (
                <VoteButtons key={generationId} generationId={generationId} />
            )}
        </section>
    );
}