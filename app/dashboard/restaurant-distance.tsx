"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { formatDistance, haversineMiles, isCoordinates } from "@/utils/distance";
import type { VerifiedRestaurant } from "@/utils/restaurant-location";
import { useLocation } from "./location-provider";

// Mounted only while location is enabled, so turning it off discards place results too.
function EnabledDistance({ generationId }: { generationId: string }) {
    const { coordinates } = useLocation();
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
                    if (!data.restaurant) setError("Distance unavailable — we couldn’t confirm this restaurant’s location.");
                }
            } catch (error) {
                if (!controller.signal.aborted) setError(error instanceof Error && error.name !== "TimeoutError" ? error.message : "Distance lookup took too long. Please try again.");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        // Defer one task so React development remounts do not trigger duplicate paid lookups.
        const start = setTimeout(() => { void load(); }, 0);
        return () => { clearTimeout(start); controller.abort(); };
    }, [generationId, attempt]);

    if (!coordinates) return null;
    return <div className="restaurant-distance" role="status">
        {loading ? <p>Checking restaurant distance…</p> : restaurant ? <>
            <p className="distance-value"><MapPin size={14} aria-hidden="true" />{formatDistance(haversineMiles(coordinates, restaurant))}</p>
            <p>Approx. straight-line distance · not walking distance</p>
            <p className="distance-source">Restaurant location: <a href={restaurant.mapsUrl} target="_blank" rel="noopener noreferrer" className="maps-attribution" translate="no">Google Maps</a>
                {restaurant.attributions.map((item, index) => <span key={index}> · {item.uri ? <a href={item.uri} target="_blank" rel="noopener noreferrer">{item.name}</a> : item.name}</span>)}
            </p>
            <p className="distance-address">{restaurant.address}</p>
        </> : <p>{error} <button type="button" className="location-off" onClick={() => { setError(""); setLoading(true); setAttempt(value => value + 1); }}>Retry</button></p>}
    </div>;
}

export default function RestaurantDistance({ generationId }: { generationId: string }) {
    const { coordinates } = useLocation();
    return coordinates ? <EnabledDistance key={generationId} generationId={generationId} /> : null;
}
