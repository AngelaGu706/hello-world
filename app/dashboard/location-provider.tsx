"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { requestCurrentLocation, type Coordinates } from "@/utils/distance";
import { neighborhoodCenters } from "@/utils/neighborhood-centers";
import type { Neighborhood } from "@/utils/food-neighborhoods";

type Origin = { kind: "current"; coordinates: Coordinates } |
    { kind: "neighborhood"; name: Neighborhood; coordinates: Coordinates };
type LocationContext = {
    origin: Origin | null;
    loading: boolean;
    error: string;
    enable: () => void;
    selectNeighborhood: (name: Neighborhood | "") => void;
    disable: () => void;
};
const Context = createContext<LocationContext | null>(null);

export default function LocationProvider({ children }: { children: React.ReactNode }) {
    // Memory only: never add storage, database writes, telemetry, or network calls here.
    const [origin, setOrigin] = useState<Origin | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const requestId = useRef(0);
    const busy = useRef(false);
    useEffect(() => () => { requestId.current++; }, []);

    async function enable() {
        if (busy.current) return;
        busy.current = true;
        const id = ++requestId.current;
        setLoading(true);
        setError("");
        try {
            const point = await requestCurrentLocation(window.isSecureContext, navigator.geolocation);
            if (id === requestId.current) setOrigin({ kind: "current", coordinates: point });
        } catch (error) {
            if (id === requestId.current) setError(error instanceof Error ? error.message : "Couldn’t read your location. Please try again.");
        } finally {
            if (id === requestId.current) { setLoading(false); busy.current = false; }
        }
    }

    function cancelPending() {
        requestId.current++;
        busy.current = false;
        setLoading(false);
        setError("");
    }
    function selectNeighborhood(name: Neighborhood | "") {
        cancelPending();
        setOrigin(name ? { kind: "neighborhood", name, coordinates: neighborhoodCenters[name] } : null);
    }
    function disable() {
        // getCurrentPosition cannot be cancelled; ignore any late permission callback.
        cancelPending();
        setOrigin(null);
    }

    return <Context.Provider value={{ origin, loading, error, enable, selectNeighborhood, disable }}>{children}</Context.Provider>;
}

export function useLocation() {
    const context = useContext(Context);
    if (!context) throw new Error("Location must be inside its provider.");
    return context;
}
