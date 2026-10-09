export const commonCuisines = ["Chinese", "Italian", "Japanese"] as const;
export const moreCuisines = [
    "American", "Caribbean", "Ethiopian", "French", "Greek", "Indian", "Korean", "Lebanese",
    "Mexican", "Middle Eastern", "Peruvian", "Spanish", "Thai", "Turkish", "Vietnamese",
] as const;
export const cuisines = [...commonCuisines, ...moreCuisines] as const;
export type Cuisine = (typeof cuisines)[number];

export function isCuisine(value: unknown): value is Cuisine {
    return typeof value === "string" && cuisines.some((cuisine) => cuisine === value);
}

// Earlier picks have no cuisine field. Recognize specific cuisine names or dishes;
// leave mixed picks and ambiguous foods (coffee, brunch, generic dumplings) unclassified.
export function inferLegacyCuisine(text: string): Cuisine | null {
    const patterns: Partial<Record<Cuisine, RegExp>> = {
        Chinese: /\b(chinese|dim sum|xiao long bao|soup dumplings|mapo tofu|sichuan|szechuan|fuzhou)\b/i,
        Italian: /\b(italian|pizza|pizzeria|pasta|risotto|gnocchi|lasagna)\b/i,
        Japanese: /\b(japanese|sushi|ramen|udon|soba|yakitori|tonkatsu|omakase)\b/i,
        Korean: /\b(korean|bibimbap|bulgogi|kimchi|tteokbokki|kimbap)\b/i,
        Mexican: /\b(mexican|tacos?|burritos?|quesadillas?|enchiladas?|taqueria)\b/i,
        French: /\bfrench\b(?!\s+(?:fries|toast)\b)/i,
        Thai: /\b(thai|pad thai|tom yum)\b/i,
        Vietnamese: /\b(vietnamese|pho|banh mi)\b/i,
        Ethiopian: /\b(ethiopian|injera)\b/i,
        Indian: /\b(indian|biryani|dosa|tikka masala|chole|palak paneer)\b/i,
    };
    const matches = cuisines.filter((cuisine) => (patterns[cuisine] ?? new RegExp(`\\b${cuisine}\\b`, "i")).test(text));
    return matches.length === 1 ? matches[0] : null;
}
