import { isCoordinates, type Coordinates } from "./distance";

export type VerifiedRestaurant = Coordinates & {
    placeId: string;
    address: string;
    mapsUrl: string;
    attributions: { name: string; uri?: string }[];
};

type AddressComponent = { longText?: string; shortText?: string; types?: string[] };
type Place = {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    addressComponents?: AddressComponent[];
    location?: Coordinates;
    types?: string[];
    businessStatus?: string;
    googleMapsUri?: string;
    attributions?: { provider?: string; providerUri?: string }[];
};

export function normalizePlaceName(value: string): string {
    return value.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "")
        .replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

// Google's documented NYC viewport is only a search constraint, never a venue coordinate.
export const NYC_VIEWPORT = {
    low: { latitude: 40.477398, longitude: -74.259087 },
    high: { latitude: 40.91618, longitude: -73.70018 },
};

function isNYC(point: Coordinates) {
    return point.latitude >= NYC_VIEWPORT.low.latitude && point.latitude <= NYC_VIEWPORT.high.latitude &&
        point.longitude >= NYC_VIEWPORT.low.longitude && point.longitude <= NYC_VIEWPORT.high.longitude;
}

function safeHttps(value: string | undefined) {
    try { const url = new URL(value ?? ""); return url.protocol === "https:" ? url.href : undefined; }
    catch { return undefined; }
}

export function selectVerifiedRestaurant(payload: { places?: Place[]; nextPageToken?: string }, name: string, area: string): VerifiedRestaurant | null {
    // Do not choose the first result or infer a branch from a neighborhood center.
    if (!name.trim() || !area.trim() || payload.nextPageToken || !Array.isArray(payload.places)) return null;
    const matches = payload.places.filter(place => {
        const components = place.addressComponents ?? [];
        const has = (type: string, text?: string) => components.some(component =>
            component.types?.includes(type) && (!text || [component.longText, component.shortText]
                .some(value => value && normalizePlaceName(value) === normalizePlaceName(text))));
        const matchingArea = components.some(component => component.types?.some(type =>
            ["neighborhood", "sublocality", "sublocality_level_1", "sublocality_level_2"].includes(type)) &&
            [component.longText, component.shortText].some(value => value && normalizePlaceName(value) === normalizePlaceName(area)));
        const borough = ["New York", "Manhattan", "Brooklyn", "Queens", "Bronx", "The Bronx", "Staten Island"];
        const inCity = components.some(component => component.types?.some(type =>
            ["locality", "sublocality", "sublocality_level_1"].includes(type)) &&
            borough.some(value => normalizePlaceName(component.longText ?? "") === normalizePlaceName(value)));
        return place.id && place.displayName?.text && normalizePlaceName(place.displayName.text) === normalizePlaceName(name) &&
            place.businessStatus === "OPERATIONAL" && place.types?.some(type =>
                ["restaurant", "cafe", "bakery", "bar", "meal_takeaway"].includes(type) || type.endsWith("_restaurant")) &&
            isCoordinates(place.location) && isNYC(place.location) && inCity &&
            has("country", "US") && has("administrative_area_level_1", "NY") &&
            has("street_number") && has("route") && matchingArea && place.formattedAddress;
    });
    const distinct = [...new Map(matches.map(place => [place.id, place])).values()];
    if (distinct.length !== 1) return null;
    const place = distinct[0];
    return {
        ...place.location!, placeId: place.id!, address: place.formattedAddress!,
        mapsUrl: `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: place.displayName!.text!, query_place_id: place.id! })}`,
        attributions: (place.attributions ?? []).filter(item => item.provider).map(item => ({
            name: item.provider!, ...(safeHttps(item.providerUri) ? { uri: safeHttps(item.providerUri) } : {}),
        })),
    };
}

export async function lookupRestaurant(name: string, area: string, apiKey: string, signal?: AbortSignal): Promise<VerifiedRestaurant | null> {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST", cache: "no-store",
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
        headers: {
            "Content-Type": "application/json", "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location,places.types,places.businessStatus,places.attributions,nextPageToken",
        },
        body: JSON.stringify({
            textQuery: `${name}, ${area}, New York City, NY, USA`, languageCode: "en", regionCode: "US",
            locationRestriction: { rectangle: NYC_VIEWPORT }, pageSize: 20, includePureServiceAreaBusinesses: false,
        }),
    });
    if (!response.ok) throw new Error("Place lookup unavailable");
    return selectVerifiedRestaurant(await response.json(), name, area);
}
