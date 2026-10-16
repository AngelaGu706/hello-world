import neighborhoods from "@/data/nyc-neighborhoods.json";
import { neighborhoodCenters } from "./neighborhood-centers";
import { isNeighborhood } from "./food-neighborhoods";
import type { Coordinates } from "./distance";

export function normalizeArea(value: string) {
    return value.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "")
        .replace(/[’']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function areasForName(name: string) {
    const selection = Object.keys(neighborhoodCenters).find(value => normalizeArea(value) === normalizeArea(name));
    if (isNeighborhood(selection)) {
        const ids: readonly string[] = neighborhoodCenters[selection].ntaIds;
        return neighborhoods.filter(area => ids.includes(area.id));
    }
    // Unknown neighborhood labels do not acquire an invented center or fuzzy boundary.
    return neighborhoods.filter(area => normalizeArea(area.name) === normalizeArea(name));
}

export function pointInRing(point: Coordinates, ring: number[][]): boolean {
    const x = point.longitude, y = point.latitude;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        const cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
        if (Math.abs(cross) < 1e-12 && x >= Math.min(xi, xj) && x <= Math.max(xi, xj) &&
            y >= Math.min(yi, yj) && y <= Math.max(yi, yj)) return true;
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

export function pointInArea(point: Coordinates, polygons: number[][][][]): boolean {
    return polygons.some(polygon => pointInRing(point, polygon[0]) &&
        !polygon.slice(1).some(hole => pointInRing(point, hole)));
}
