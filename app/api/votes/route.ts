import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
        }

        const body = await request.json().catch(() => null);
        const generationId = body?.generationId;
        const vote = body?.vote;
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (
            typeof generationId !== "string" || !uuid.test(generationId) ||
            (vote !== "up" && vote !== "down")
        ) {
            return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from("votes")
            .insert({
                user_id: user.id,
                generation_id: generationId,
                vote,
            })
            .select("id, vote")
            .single();

        if (error && error.code !== "23505") {
            if (error.code === "23503") {
                return NextResponse.json(
                    { error: "Recommendations no longer exist." },
                    { status: 404 }
                );
            }
            console.error("Saving vote failed:", error);
            return NextResponse.json({ error: "Could not save vote." }, { status: 500 });
        }

        const { data: ratings, error: ratingsError } = await supabase.rpc("get_generation_ratings", {
            generation_ids: [generationId],
        });
        const row = ratings?.[0];
        const rating = !ratingsError && row ? {
            myVote: row.my_vote,
            upCount: Number(row.up_count),
            downCount: Number(row.down_count),
        } : null;

        if (ratingsError) console.error("Refreshing ratings failed:", ratingsError);

        // A successful insert is still a saved vote when aggregate totals cannot be read.
        let ownVote = data?.vote ?? null;
        if (!rating && error?.code === "23505") {
            const { data: existingVote } = await supabase.from("votes")
                .select("vote")
                .eq("user_id", user.id)
                .eq("generation_id", generationId)
                .maybeSingle();
            ownVote = existingVote?.vote ?? null;
        }
        const currentRating = rating ?? { myVote: ownVote, upCount: null, downCount: null };

        if (error?.code === "23505") {
            return NextResponse.json(
                { error: "You have already rated this pick.", rating: currentRating },
                { status: 409 }
            );
        }

        return NextResponse.json({ ...data, rating: currentRating }, { status: 201 });
    } catch (error) {
        console.error("Vote request failed:", error);
        return NextResponse.json({ error: "Could not save vote." }, { status: 500 });
    }
}
