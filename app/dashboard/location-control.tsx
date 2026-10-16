"use client";

import { useId } from "react";
import Link from "next/link";
import { LocateFixed, LoaderCircle } from "lucide-react";
import { isNeighborhood, neighborhoodGroups } from "@/utils/food-neighborhoods";
import { useLocation } from "./location-provider";

export default function LocationControl() {
    const { origin, loading, error, enable, selectNeighborhood, disable } = useLocation();
    const id = useId();
    return <section className="location-control" aria-label="Restaurant distances">
        <label className="distance-origin-label" htmlFor={id}>Distance from</label>
        <div className="location-actions">
            <select id={id} className="distance-origin-select" value={origin?.kind === "neighborhood" ? origin.name : ""}
                onChange={event => { const name = event.target.value; if (name === "" || isNeighborhood(name)) selectNeighborhood(name); }}>
                <option value="">{origin?.kind === "current" ? "Your current location" : "Choose a neighborhood center"}</option>
                {neighborhoodGroups.map(group => <optgroup key={group.label} label={group.label}>
                    {group.neighborhoods.map(name => <option key={name} value={name}>{name}</option>)}
                </optgroup>)}
            </select>
            <button type="button" className="location-button" disabled={loading} onClick={enable}>
                {loading ? <LoaderCircle size={16} className="is-spinning" aria-hidden="true" /> : <LocateFixed size={16} aria-hidden="true" />}
                {loading ? "Getting location…" : origin?.kind === "current" ? "Update my location" : "Use my location"}
            </button>
            {(origin || loading) && <button type="button" className="location-off" onClick={disable}>{loading ? "Cancel" : "Turn off"}</button>}
        </div>
        <p role="status">{error || (origin?.kind === "neighborhood"
            ? `Distances start at the approximate ${origin.name} area center. No location permission needed.`
            : origin?.kind === "current" ? "Distances use your location on this page. It isn’t sent or saved."
                : "Choose an area center, or use your current location. Distances are approximate.")}</p>
        <Link href="/privacy">Location privacy</Link><span aria-hidden="true"> · </span><Link href="/terms">Terms</Link>
    </section>;
}
