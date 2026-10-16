"use client";

import Link from "next/link";
import { LocateFixed, LoaderCircle } from "lucide-react";
import { useLocation } from "./location-provider";

export default function LocationControl() {
    const { coordinates, loading, error, enable, disable } = useLocation();
    return <section className="location-control" aria-label="Restaurant distances">
        <div className="location-actions">
            <button type="button" className="location-button" disabled={loading} onClick={enable}>
                {loading ? <LoaderCircle size={16} className="is-spinning" aria-hidden="true" /> : <LocateFixed size={16} aria-hidden="true" />}
                {loading ? "Getting location…" : coordinates ? "Update my location" : "Use my location"}
            </button>
            {(coordinates || loading) && <button type="button" className="location-off" onClick={disable}>{loading ? "Cancel" : "Turn off"}</button>}
        </div>
        <p role="status">{error || (coordinates ? "Distances use your location on this page. It isn’t sent or saved." : "See approximate distances. Your location stays in your browser.")}</p>
        <Link href="/privacy">Location privacy</Link><span aria-hidden="true"> · </span><Link href="/terms">Terms</Link>
    </section>;
}
