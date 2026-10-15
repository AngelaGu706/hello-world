"use client";

import { useState } from "react";
import { Bookmark, Check, LoaderCircle } from "lucide-react";
import { useBucketList } from "./bucket-list-provider";

export default function BookmarkButton({ generationId }: { generationId: string }) {
    const { items, loading, error: loadError, busyIds, reload, change } = useBucketList();
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const saved = items.some(item => item.generation_id === generationId);
    const busy = busyIds.has(generationId);
    const label = loading ? "Loading..." : busy ? (saved ? "Removing..." : "Saving...") : saved ? "Saved" : "Save";

    async function toggle() {
        setError("");
        setMessage("");
        try {
            await change(generationId, saved ? "DELETE" : "POST");
            setMessage(saved ? "Removed from Your List." : "Saved to Your List.");
        }
        catch (error) { setError(error instanceof Error ? error.message : "Please try again."); }
    }

    return <div className="bookmark-control">
        <button type="button" className={`bucket-save ${saved ? "is-saved" : ""}`} disabled={loading || busy || Boolean(loadError)}
            aria-pressed={saved} aria-busy={loading || busy}
            aria-label={saved ? "Saved to Your List; click to remove" : "Save to Your List"}
            title={saved ? "Saved to Your List. Click to remove." : "Save to Your List"} onClick={toggle}>
            {loading || busy ? <LoaderCircle size={16} className="is-spinning" aria-hidden="true" /> : saved ? <Check size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}
            <span className="bookmark-label">{label}</span>
        </button>
        <span className="sr-only" role="status">{message}</span>
        {loadError && <p className="community-error" role="alert">{loadError} <button type="button" className="community-clear" onClick={reload}>Retry</button></p>}
        {error && <p className="community-error" role="alert">{error}</p>}
    </div>;
}
