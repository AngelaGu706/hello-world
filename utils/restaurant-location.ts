import { isCoordinates, type Coordinates } from "./distance";
import { areasForName, pointInArea } from "./neighborhood-geography";

export const RESTAURANT_SOURCE_URL = "https://data.cityofnewyork.us/d/43nn-pn8j";
export type VerifiedRestaurant = Coordinates & {
    recordId: string;
    address: string;
    sourceUrl: string;
    sourceDate: string | null;
};

type RestaurantRow = {
    camis?: string; dba?: string; boro?: string; building?: string; street?: string;
    zipcode?: string; latitude?: string; longitude?: string; recorded_at?: string;
};

export function normalizePlaceName(value: string): string {
    return value.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "")
        .replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function selectVerifiedRestaurant(payload: unknown, name: string, area: string): VerifiedRestaurant | null {
    const regions = areasForName(area);
    // Query caps at 101 distinct records; incomplete candidate sets cannot establish uniqueness.
    if (!name.trim() || !regions.length || !Array.isArray(payload) || payload.length > 100) return null;
    const named = (payload as RestaurantRow[]).filter(row => row && typeof row.dba === "string" &&
        normalizePlaceName(row.dba) === normalizePlaceName(name));
    // An exact-name branch with unknown coordinates could also be inside the selected area.
    if (named.some(row => regions.some(region => region.borough === row.boro) &&
        (typeof row.latitude !== "string" || !row.latitude.trim() || typeof row.longitude !== "string" || !row.longitude.trim() ||
            !isCoordinates({ latitude: Number(row.latitude), longitude: Number(row.longitude) })))) return null;
    const matches = named.filter(row => {
        if (!row || typeof row !== "object" || typeof row.dba !== "string" ||
            normalizePlaceName(row.dba) !== normalizePlaceName(name)) return false;
        if (typeof row.latitude !== "string" || !row.latitude.trim() || typeof row.longitude !== "string" || !row.longitude.trim()) return false;
        const point = { latitude: Number(row.latitude), longitude: Number(row.longitude) };
        return typeof row.camis === "string" && /^\d{8}$/.test(row.camis) &&
            typeof row.building === "string" && /\d/.test(row.building) &&
            typeof row.street === "string" && !!row.street.trim() && typeof row.zipcode === "string" && /^\d{5}$/.test(row.zipcode) &&
            isCoordinates(point) && regions.some(region => region.borough === row.boro && pointInArea(point, region.polygons));
    });
    const candidates = new Map<string, RestaurantRow>();
    for (const row of matches) {
        const previous = candidates.get(row.camis!);
        // Inspection citations repeat venues. Conflicting addresses/coordinates fail closed.
        if (previous && (normalizePlaceName(`${previous.building} ${previous.street} ${previous.zipcode}`) !==
            normalizePlaceName(`${row.building} ${row.street} ${row.zipcode}`) ||
            Number(previous.latitude) !== Number(row.latitude) || Number(previous.longitude) !== Number(row.longitude))) return null;
        candidates.set(row.camis!, row);
    }
    if (candidates.size !== 1) return null;
    const row = [...candidates.values()][0];
    return {
        latitude: Number(row.latitude), longitude: Number(row.longitude), recordId: row.camis!,
        address: `${row.building} ${row.street}, ${row.boro}, NY ${row.zipcode}`,
        sourceUrl: RESTAURANT_SOURCE_URL,
        sourceDate: typeof row.recorded_at === "string" && /^\d{4}-\d{2}-\d{2}T/.test(row.recorded_at) ? row.recorded_at.slice(0, 10) : null,
    };
}

export async function lookupRestaurant(name: string, area: string, signal?: AbortSignal): Promise<VerifiedRestaurant | null> {
    const regions = areasForName(area);
    if (!name.trim() || !regions.length) return null;
    // A broad, ASCII-only token retrieves candidates; full normalized name and geometry verify them.
    // Discard short possessive fragments so Jack's can be found through the token FREDA.
    const tokens = name.normalize("NFKD").replace(/\p{M}/gu, "").toUpperCase().match(/[A-Z0-9]+/g) ?? [];
    const token = tokens.sort((a, b) => b.length - a.length)[0];
    if (!token || token.length < 3) return null;
    const fields = "camis,dba,boro,building,street,zipcode,latitude,longitude";
    const params = new URLSearchParams({
        "$select": `${fields},max(record_date) as recorded_at`,
        "$where": `upper(dba) like '%${token}%' AND boro = '${regions[0].borough}'`,
        "$group": fields, "$limit": "101",
    });
    const response = await fetch(`https://data.cityofnewyork.us/resource/43nn-pn8j.json?${params}`, {
        // Only public restaurant data is cached. User coordinates never leave the browser.
        cache: "force-cache", next: { revalidate: 86400 },
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("NYC restaurant data is temporarily unavailable. Please try again later.");
    return selectVerifiedRestaurant(await response.json(), name, area);
}
