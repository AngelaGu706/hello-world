export const neighborhoodGroups = [
    { label: "Manhattan", neighborhoods: ["Morningside Heights", "Upper West Side", "Midtown", "West Village", "Chinatown"] },
    { label: "Brooklyn", neighborhoods: ["Williamsburg"] },
    { label: "Queens", neighborhoods: ["Astoria", "Flushing"] },
] as const;

export type Neighborhood = (typeof neighborhoodGroups)[number]["neighborhoods"][number];

export function isNeighborhood(value: unknown): value is Neighborhood {
    return typeof value === "string" && neighborhoodGroups.some(group =>
        group.neighborhoods.some(neighborhood => neighborhood === value));
}
