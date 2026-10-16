"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { requestCurrentLocation, type Coordinates } from "@/utils/distance";

type LocationContext = {
    coordinates: Coordinates | null;
    loading: boolean;
    error: string;
    enable: () => void;
    disable: () => void;
};
const Context = createContext<LocationContext | null>(null);

export default function LocationProvider({ children }: { children: React.ReactNode }) {
    // Memory only: never add storage, database writes, telemetry, or network calls here.
    const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
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
            if (id === requestId.current) setCoordinates(point);
        } catch (error) {
            if (id === requestId.current) setError(error instanceof Error ? error.message : "Couldn’t read your location. Please try again.");
        } finally {
            if (id === requestId.current) { setLoading(false); busy.current = false; }
        }
    }

    function disable() {
        // getCurrentPosition cannot be cancelled; ignore any late permission callback.
        requestId.current++;
        busy.current = false;
        setCoordinates(null);
        setLoading(false);
        setError("");
    }

    return <Context.Provider value={{ coordinates, loading, error, enable, disable }}>{children}</Context.Provider>;
}

export function useLocation() {
    const context = useContext(Context);
    if (!context) throw new Error("Location must be inside its provider.");
    return context;
}
