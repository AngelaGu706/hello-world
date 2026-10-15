"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { isNeighborhood, neighborhoodGroups, type Neighborhood } from "@/utils/food-neighborhoods";

export default function NeighborhoodSelector({ value, onChange, disabled }: {
    value: Neighborhood | "";
    onChange: (value: Neighborhood | "") => void;
    disabled: boolean;
}) {
    const id = useId();
    return <div className="cuisine-selector">
        <label htmlFor={id} className="cuisine-label">Neighborhood</label>
        <div className={`cuisine-dropdown${value ? " is-selected" : ""}`}>
            <select id={id} aria-label="Choose a neighborhood" value={value} disabled={disabled}
                onChange={event => {
                    const next = event.target.value;
                    if (next === "" || isNeighborhood(next)) onChange(next);
                }}>
                <option value="">Anywhere in NYC</option>
                {neighborhoodGroups.map(group => <optgroup key={group.label} label={group.label}>
                    {group.neighborhoods.map(neighborhood => <option key={neighborhood} value={neighborhood}>{neighborhood}</option>)}
                </optgroup>)}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
        </div>
    </div>;
}
