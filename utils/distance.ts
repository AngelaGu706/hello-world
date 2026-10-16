export type Coordinates = { latitude: number; longitude: number };

export function isCoordinates(value: unknown): value is Coordinates {
    const point = value as Coordinates | null;
    return !!point && typeof point.latitude === "number" && typeof point.longitude === "number" &&
        Number.isFinite(point.latitude) && Number.isFinite(point.longitude) &&
        Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}

export function haversineMiles(from: Coordinates, to: Coordinates): number {
    if (!isCoordinates(from) || !isCoordinates(to)) throw new Error("Invalid coordinates");
    const radians = (degrees: number) => degrees * Math.PI / 180;
    const a = Math.sin(radians(to.latitude - from.latitude) / 2) ** 2 +
        Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) *
        Math.sin(radians(to.longitude - from.longitude) / 2) ** 2;
    return 3958.7613 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
}

export function formatDistance(miles: number): string {
    if (miles < 0.1) return "Less than 0.1 miles away";
    return `About ${miles.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} miles away`;
}
