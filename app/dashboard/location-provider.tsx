"use client";

import { createContext, useContext, useState } from "react";
import type { Coordinates } from "@/utils/distance";
import { neighborhoodCenters } from "@/utils/neighborhood-centers";
import type { Neighborhood } from "@/utils/food-neighborhoods";

type Origin = { name: Neighborhood; coordinates: Coordinates };
type LocationContext = {
    origin: Origin | null;
    selectNeighborhood: (name: Neighborhood | "") => void;
};
const Context = createContext<LocationContext | null>(null);

export default function LocationProvider({ children }: { children: React.ReactNode }) {
    // A public area center, kept in memory only. No device location is requested.
    const [origin, setOrigin] = useState<Origin | null>(null);
    function selectNeighborhood(name: Neighborhood | "") {
        setOrigin(name ? { name, coordinates: neighborhoodCenters[name] } : null);
    }
    return <Context.Provider value={{ origin, selectNeighborhood }}>{children}</Context.Provider>;
}

export function useLocation() {
    const context = useContext(Context);
    if (!context) throw new Error("Location must be inside its provider.");
    return context;
}
