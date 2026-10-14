export type PickRating = {
    myVote: "up" | "down" | null;
    upCount: number | null;
    downCount: number | null;
};

export const generationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPickRating(value: unknown): value is PickRating {
    if (!value || typeof value !== "object") return false;
    const rating = value as PickRating;
    const count = (value: unknown) => value === null || (Number.isSafeInteger(value) && Number(value) >= 0);
    return (rating.myVote === null || rating.myVote === "up" || rating.myVote === "down")
        && count(rating.upCount) && count(rating.downCount);
}
