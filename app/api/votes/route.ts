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

        if (error) {
            if (error.code === "23505") {
                return NextResponse.json(
                    { error: "You have already rated these recommendations." },
                    { status: 409 }
                );
            }
            if (error.code === "23503") {
                return NextResponse.json(
                    { error: "Recommendations no longer exist." },
                    { status: 404 }
                );
            }
            console.error("Saving vote failed:", error);
            return NextResponse.json({ error: "Could not save vote." }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error("Vote request failed:", error);
        return NextResponse.json({ error: "Could not save vote." }, { status: 500 });
    }
}