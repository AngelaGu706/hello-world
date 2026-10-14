import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generationIdPattern } from "@/utils/generation-ratings";
import { loadGenerationRatings } from "@/utils/supabase/generation-ratings";

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
        }
        const generationId = new URL(request.url).searchParams.get("generationId");
        if (!generationId || !generationIdPattern.test(generationId)) {
            return NextResponse.json({ error: "Invalid recommendation" }, { status: 400 });
        }
        const { ratings, ratingsError } = await loadGenerationRatings(supabase, [generationId], user.id);
        return NextResponse.json({ rating: ratings.get(generationId), ratingsError }, {
            status: ratingsError ? 503 : 200,
            headers: { "Cache-Control": "private, no-store" },
        });
    } catch (error) {
        console.error("Loading ratings failed:", error);
        return NextResponse.json({ error: "Couldn't load ratings. Please try again." }, { status: 500 });
    }
}

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
        if (typeof generationId !== "string" || !generationIdPattern.test(generationId)
            || (vote !== "up" && vote !== "down")) {
            return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
        }

        const { data, error } = await supabase.from("votes")
            .insert({ user_id: user.id, generation_id: generationId, vote })
            .select("id, vote").single();

        if (error && error.code !== "23505") {
            if (error.code === "23503") {
                return NextResponse.json({ error: "Recommendations no longer exist." }, { status: 404 });
            }
            console.error("Saving vote failed:", error);
            return NextResponse.json({ error: "Couldn't save rating. Please try again." }, { status: 500 });
        }

        const { ratings, ratingsError } = await loadGenerationRatings(supabase, [generationId], user.id);
        const rating = ratings.get(generationId)!;
        // Aggregate reads can fail after a successful write. Preserve that saved
        // vote and let the UI retry the read without submitting another vote.
        if (!error) rating.myVote = data?.vote ?? vote;

        if (error?.code === "23505") {
            return NextResponse.json({ error: "You have already rated this pick.", rating, ratingsError }, { status: 409 });
        }
        return NextResponse.json({ ...data, rating, ratingsError }, { status: 201 });
    } catch (error) {
        console.error("Vote request failed:", error);
        return NextResponse.json({ error: "Couldn't save rating. Please try again." }, { status: 500 });
    }
}
