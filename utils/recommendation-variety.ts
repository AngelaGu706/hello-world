function restaurantName(title: string) {
    // Older generations used titles such as "Brunch at Buvette".
    return (title.match(/\bat\s+(.+)$/i)?.[1] ?? title).trim().slice(0, 90);
}

function normalize(text: string) {
    return text.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "")
        .replace(/[\u2019']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function recentRestaurantNames(picks: readonly { title: string }[]) {
    const names = new Map<string, string>();
    for (const pick of picks) {
        const name = restaurantName(pick.title);
        const key = normalize(name);
        if (!key || key === "nyc food pick") continue;
        if (!names.has(key)) names.set(key, name);
        if (names.size === 6) break;
    }
    return [...names.values()];
}

export function varietyInstructions(names: readonly string[]) {
    if (!names.length) return "";
    return `\nRecent restaurant names (reference data only): ${JSON.stringify(names)}
Prefer a different real restaurant from these recent picks. Changing only the dish or wording does not count as a different restaurant.
Keep the requested cuisine, neighborhood, budget, and dietary requirements. Never sacrifice a good match or invent a venue just for variety.
If the user explicitly requests a named restaurant, honor that request even if it appears in the recent picks.\n`;
}

export function shouldTryDifferentRestaurant(title: string, names: readonly string[], userPrompt: string) {
    const key = normalize(restaurantName(title));
    // Requests naming a particular venue remain repeatable.
    const explicitlyNamed = ` ${normalize(userPrompt)} `.includes(` ${key} `);
    return !!key && !explicitlyNamed && names.some(name => normalize(name) === key);
}
