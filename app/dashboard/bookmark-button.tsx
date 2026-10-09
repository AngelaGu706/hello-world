"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck, LoaderCircle } from "lucide-react";
import { useBucketList } from "./bucket-list-provider";

export default function BookmarkButton({ generationId }: { generationId: string }) {
    const { items, loading, error: loadError, busyIds, reload, change } = useBucketList();
    const [error, setError] = useState("");
    const saved = items.some(item => item.generation_id === generationId);
    const busy = busyIds.has(generationId);

    async function toggle() {
        setError("");
        try { await change(generationId, saved ? "DELETE" : "POST"); }
        catch (error) { setError(error instanceof Error ? error.message : "Please try again."); }
    }

    return <div className="bookmark-control">
        <button type="button" className={`bucket-save ${saved ? "is-saved" : ""}`} disabled={loading || busy || Boolean(loadError)}
            aria-pressed={saved} aria-label={saved ? "Remove from Food Bucket List" : "Save to Food Bucket List"} onClick={toggle}>
            {loading || busy ? <LoaderCircle size={16} className="is-spinning" aria-hidden="true" /> : saved ? <BookmarkCheck size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}
            {busy ? "Saving..." : saved ? "Saved to my list" : "Save to my list"}
        </button>
        {loadError && <p className="community-error" role="alert">{loadError} <button type="button" className="community-clear" onClick={reload}>Retry</button></p>}
        {error && <p className="community-error" role="alert">{error}</p>}
    </div>;
}
