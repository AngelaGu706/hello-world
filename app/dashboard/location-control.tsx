"use client";

import { useId } from "react";
import { isNeighborhood, neighborhoodGroups } from "@/utils/food-neighborhoods";
import { useLocation } from "./location-provider";

export default function LocationControl() {
    const { origin, selectNeighborhood } = useLocation();
    const id = useId();
    return <section className="location-control" aria-label="Restaurant distances">
        <label className="distance-origin-label" htmlFor={id}>Distance from</label>
        <div className="location-actions">
            <select id={id} className="distance-origin-select" value={origin?.name ?? ""} aria-describedby={`${id}-hint`}
                onChange={event => { const name = event.target.value; if (name === "" || isNeighborhood(name)) selectNeighborhood(name); }}>
                <option value="">Choose a neighborhood</option>
                {neighborhoodGroups.map(group => <optgroup key={group.label} label={group.label}>
                    {group.neighborhoods.map(name => <option key={name} value={name}>{name}</option>)}
                </optgroup>)}
            </select>
            {origin && <button type="button" className="location-off" onClick={() => selectNeighborhood("")}>Clear</button>}
        </div>
        <p id={`${id}-hint`}>Approx. straight-line miles from the selected area center, not walking distance.</p>
    </section>;
}
