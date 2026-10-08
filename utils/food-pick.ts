export type PickContent = {
    area: string;
    food: string;
    recommendation: string;
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
            return { area: value.area, food: value.food, recommendation: value.recommendation };
        }
    } catch {
        // Earlier picks were saved as Markdown; keep their full text available.
    }
    return { area: "", food: "", recommendation: content };
}
