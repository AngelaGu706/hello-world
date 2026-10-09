"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { isCuisine, type Cuisine } from "@/utils/food-cuisines";

const cuisineOptions = [
    "American", "Chinese", "Italian", "Japanese", "Korean", "French", "Thai", "Mexican",
] as const satisfies readonly Cuisine[];

type Props = {
    value: Cuisine | "";
    onChange: (value: Cuisine | "") => void;
    label: string;
    groupLabel: string;
    allLabel: string;
    disabled?: boolean;
    className?: string;
};

export default function CuisineSelector({ value, onChange, label, groupLabel, allLabel, disabled = false, className = "" }: Props) {
    const selectId = useId();
    return <div className={`cuisine-selector ${className}`}>
        <label htmlFor={selectId} className="cuisine-label">{label}</label>
        <div className={`cuisine-dropdown${value ? " is-selected" : ""}`}>
            <select id={selectId} aria-label={groupLabel} value={value} disabled={disabled}
                onChange={(event) => {
                    const selected = event.target.value;
                    if (selected === "" || isCuisine(selected)) onChange(selected);
                }}>
                <option value="">{allLabel}</option>
                {cuisineOptions.map((cuisine) => <option key={cuisine} value={cuisine}>{cuisine}</option>)}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
        </div>
    </div>;
}
