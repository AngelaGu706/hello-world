"use client";

import { ChevronDown } from "lucide-react";
import { commonCuisines, isCuisine, moreCuisines, type Cuisine } from "@/utils/food-cuisines";

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
    const selectedMore = moreCuisines.some((cuisine) => cuisine === value);
    return <div className={`cuisine-selector ${className}`}>
        <p className="cuisine-label">{label}</p>
        <div className="cuisine-options" role="group" aria-label={groupLabel}>
            {(["", ...commonCuisines] as const).map((option) => (
                <button key={option || "all"} type="button" disabled={disabled}
                    aria-pressed={value === option} className={value === option ? "is-selected" : ""}
                    onClick={() => onChange(option)}>
                    {option || allLabel}
                </button>
            ))}
            <div className={`cuisine-more${selectedMore ? " is-selected" : ""}`}>
                <select aria-label="More cuisines" value={selectedMore ? value : ""} disabled={disabled}
                    onChange={(event) => { if (isCuisine(event.target.value)) onChange(event.target.value); }}>
                    <option value="" disabled>More cuisines</option>
                    {moreCuisines.map((cuisine) => <option key={cuisine} value={cuisine}>{cuisine}</option>)}
                </select>
                <ChevronDown size={14} aria-hidden="true" />
            </div>
        </div>
    </div>;
}
