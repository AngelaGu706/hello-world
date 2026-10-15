export const neighborhoodGroups = [
    { label: "Manhattan", neighborhoods: ["Morningside Heights", "Harlem", "Upper West Side", "Upper East Side", "Midtown", "Koreatown", "Chelsea", "West Village", "East Village", "Lower East Side", "Chinatown"] },
    { label: "Brooklyn", neighborhoods: ["Williamsburg", "Greenpoint", "Park Slope"] },
    { label: "Queens", neighborhoods: ["Astoria", "Long Island City", "Jackson Heights", "Flushing"] },
] as const;

export type Neighborhood = (typeof neighborhoodGroups)[number]["neighborhoods"][number];

export function isNeighborhood(value: unknown): value is Neighborhood {
    return typeof value === "string" && neighborhoodGroups.some(group =>
        group.neighborhoods.some(neighborhood => neighborhood === value));
}
