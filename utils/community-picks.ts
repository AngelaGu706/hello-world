type CommunityPickIdentity = {
    id: string;
    created_at: string;
};

export function uniqueLatestPicks<T extends CommunityPickIdentity>(picks: readonly T[]): T[] {
    const ids = new Set<string>();
    return [...picks]
        .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
        .filter((pick) => {
            if (ids.has(pick.id)) return false;
            ids.add(pick.id);
            return true;
        });
}
