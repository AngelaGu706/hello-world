import { decodePickContent } from "./food-pick";

type CommunityPickIdentity = {
    id: string;
    title: string;
    prompt: string;
    content: string;
    created_at: string;
};

function normalize(text: string) {
    return text.normalize("NFKC").toLowerCase()
        .replace(/[\u2019']/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function namedPlace(title: string) {
    const name = title.match(/\bat\s+(.+)$/i)?.[1] ?? title.match(/:\s*([^:]+)$/)?.[1];
    if (!name) return "";
    // Older titles alternate between the venue name and the name plus "Pizza".
    return normalize(name).replace(/\s+pizza$/, "");
}

export function uniqueLatestPicks<T extends CommunityPickIdentity>(picks: readonly T[]): T[] {
    const ids = new Set<string>();
    const contents = new Set<string>();
    const places = new Map<string, string[]>();

    return [...picks]
        .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
        .filter((pick) => {
            if (ids.has(pick.id)) return false;
            ids.add(pick.id);

            const { area, recommendation } = decodePickContent(pick.content);
            const normalizedArea = normalize(area);
            const contentKey = JSON.stringify([normalizedArea, normalize(recommendation)]);
            const place = namedPlace(pick.title);
            const placeKey = JSON.stringify([normalize(pick.prompt), place]);
            const existingAreas = places.get(placeKey) ?? [];

            if (recommendation.trim() && contents.has(contentKey)) return false;
            if (place && existingAreas.some((existing) => !existing || !normalizedArea || existing === normalizedArea)) return false;

            contents.add(contentKey);
            if (place) places.set(placeKey, [...existingAreas, normalizedArea]);
            return true;
        });
}
