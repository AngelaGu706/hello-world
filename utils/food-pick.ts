import { inferLegacyCuisine, isCuisine, type Cuisine } from "./food-cuisines";

export type PickContent = {
    area: string;
    food: string;
    recommendation: string;
    cuisine?: Cuisine | "Other";
};

export function encodePickContent(pick: PickContent) {
    return JSON.stringify({ format: "nyc-food-pick-v1", ...pick });
}

export function decodePickContent(content: string): PickContent {
    try {
        const value = JSON.parse(content);
        if (value?.format === "nyc-food-pick-v1" &&
            typeof value.area === "string" && typeof value.food === "string" &&
            typeof value.recommendation === "string") {
            return {
                area: value.area, food: value.food, recommendation: value.recommendation,
                ...((isCuisine(value.cuisine) || value.cuisine === "Other") ? { cuisine: value.cuisine } : {}),
            };
        }
    } catch {
        // Earlier picks were saved as Markdown; keep their full text available.
    }
    return { area: "", food: "", recommendation: content };
}

export function getPickCuisine(pick: { title: string; content: string }): Cuisine | null {
    const decoded = decodePickContent(pick.content);
    if (decoded.cuisine === "Other") return null;
    return decoded.cuisine ?? inferLegacyCuisine(`${pick.title} ${decoded.food} ${decoded.recommendation}`);
}
