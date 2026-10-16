"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { formatDistance, haversineMiles, isCoordinates } from "@/utils/distance";
import type { VerifiedRestaurant } from "@/utils/restaurant-location";
import { useLocation } from "./location-provider";

// Mounted only while a distance origin is selected, so turning it off discards place results too.
function EnabledDistance({ generationId }: { generationId: string }) {
    const { origin } = useLocation();
    const [restaurant, setRestaurant] = useState<VerifiedRestaurant | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            try {
                const response = await fetch("/api/restaurant-location", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ generationId }), cache: "no-store",
                    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Couldn’t check distance.");
                if (data.restaurant !== null && !isCoordinates(data.restaurant)) throw new Error("Couldn’t verify this restaurant’s location.");
                if (!controller.signal.aborted) {
                    setRestaurant(data.restaurant);
                }
            } catch (error) {
                if (!controller.signal.aborted) setError(error instanceof Error && error.name !== "TimeoutError" ? error.message : "Distance lookup took too long. Please try again.");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        // Defer one task so React development remounts do not trigger duplicate lookups.
        const start = setTimeout(() => { void load(); }, 0);
        return () => { clearTimeout(start); controller.abort(); };
    }, [generationId, attempt]);

    if (!origin) return null;
    return <div className="restaurant-distance">
        {loading ? <p role="status">Checking distance…</p> : restaurant ? <details className="distance-details">
            <summary>
                <span className="distance-value"><MapPin size={14} aria-hidden="true" />{formatDistance(haversineMiles(origin.coordinates, restaurant))}</span>
                <span className="distance-detail-toggle">Details</span>
            </summary>
            <div className="distance-detail-body">
                <p>From the approximate {origin.name} area center.</p>
                <p className="distance-address">{restaurant.address}</p>
                <p className="distance-source"><a href={restaurant.sourceUrl} target="_blank" rel="noopener noreferrer">NYC Open Data</a>{restaurant.sourceDate && ` · Updated ${restaurant.sourceDate}`}</p>
                <p><a href="/terms">About distances</a></p>
            </div>
        </details> : <p className="distance-unavailable" role="status">Distance unavailable{error && <> · <button type="button" className="location-off" title={error} onClick={() => { setError(""); setLoading(true); setAttempt(value => value + 1); }}>Retry</button></>}</p>}
    </div>;
}

export default function RestaurantDistance({ generationId }: { generationId: string }) {
    const { origin } = useLocation();
    return origin ? <EnabledDistance key={generationId} generationId={generationId} /> : null;
}
