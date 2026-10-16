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

async function saveVote(request: Request, remove: boolean) {
    const reply = (body: object, status = 200) => NextResponse.json(body, {
        status, headers: { "Cache-Control": "private, no-store" },
    });
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return reply({ error: "Please sign in first" }, 401);
        const body = await request.json().catch(() => null);
        const generationId = body?.generationId;
        const vote = body?.vote;
        if (typeof generationId !== "string" || !generationIdPattern.test(generationId)
            || (!remove && vote !== "up" && vote !== "down")) {
            return reply({ error: "Invalid vote" }, 400);
        }

        // Explicit set/remove operations make retries safe. The unique constraint
        // keeps one vote per user and pick, including simultaneous requests.
        const { error } = remove
            ? await supabase.from("votes").delete().eq("user_id", user.id).eq("generation_id", generationId)
            : await supabase.from("votes").upsert({ user_id: user.id, generation_id: generationId, vote }, {
                onConflict: "user_id,generation_id",
            }).select("id, vote").single();
        if (error) {
            if (error.code === "23503") return reply({ error: "Recommendations no longer exist." }, 404);
            console.error("Saving vote failed:", error);
            return reply({ error: "Couldn't save rating. Please try again." }, 500);
        }

        const { ratings, ratingsError } = await loadGenerationRatings(supabase, [generationId], user.id);
        const rating = ratings.get(generationId)!;
        // A successful mutation remains saved even if the totals refresh fails.
        rating.myVote = remove ? null : vote;
        return reply({ rating, ratingsError });
    } catch (error) {
        console.error("Vote request failed:", error);
        return reply({ error: "Couldn't save rating. Please try again." }, 500);
    }
}

export async function POST(request: Request) { return saveVote(request, false); }
export async function DELETE(request: Request) { return saveVote(request, true); }
