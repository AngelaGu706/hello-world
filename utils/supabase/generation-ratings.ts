import type { createClient } from "./server";
import type { PickRating } from "../generation-ratings";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Counts must come from the aggregate RPC. RLS on votes may expose only the
// caller's rows, so counting the fallback would undercount community ratings.
export async function loadGenerationRatings(supabase: Supabase, generationIds: string[], userId: string) {
    const ratings = new Map<string, PickRating>(generationIds.map(id => [id, {
        myVote: null, upCount: null, downCount: null,
    }]));
    try {
        const { data, error } = await supabase.rpc("get_generation_ratings", { generation_ids: generationIds });
        if (error) console.error("Loading rating totals failed:", error);

        if (!error && Array.isArray(data)) {
            for (const row of data) {
                const upCount = row.up_count == null ? NaN : Number(row.up_count);
                const downCount = row.down_count == null ? NaN : Number(row.down_count);
                if (!ratings.has(row.generation_id) || !Number.isSafeInteger(upCount) || upCount < 0
                    || !Number.isSafeInteger(downCount) || downCount < 0) continue;
                ratings.set(row.generation_id, {
                    myVote: row.my_vote === "up" || row.my_vote === "down" ? row.my_vote : null,
                    upCount, downCount,
                });
            }
        }

    } catch (error) {
        console.error("Loading rating totals failed:", error);
    }

    // A rejected aggregate request must still allow the independent own-vote
    // read, so refreshes and duplicate submissions retain the saved selection.
    const unavailable = generationIds.filter(id => ratings.get(id)?.upCount === null);
    if (unavailable.length) {
        try {
            const { data: ownVotes, error: ownError } = await supabase.from("votes")
                .select("generation_id, vote").eq("user_id", userId).in("generation_id", unavailable);
            if (ownError) console.error("Loading own ratings failed:", ownError);
            if (!ownError) {
                for (const vote of ownVotes ?? []) {
                    const rating = ratings.get(vote.generation_id);
                    if (rating && (vote.vote === "up" || vote.vote === "down")) rating.myVote = vote.vote;
                }
            }
        } catch (error) {
            console.error("Loading own ratings failed:", error);
        }
    }

    const incomplete = [...ratings.values()].some(rating => rating.upCount === null);
    return { ratings, ratingsError: incomplete ? "Couldn't load ratings. Please try again." : null };
}
