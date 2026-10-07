import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const model = "gemini-3.5-flash-lite";
        const prompt =
            "Recommend 3 NYC food spots. For each, include its name, " +
            "neighborhood, and what to order. Write in English, " +
            "under 150 words total. Do not claim live availability.";

        const response = await ai.interactions.create({
            model,
            input: prompt,
        });
        const text = response.output_text;

        if (!text?.trim()) {
            throw new Error("Gemini returned no text");
        }

        const { data: generation, error: saveError } = await supabase
            .from("generations")
            .insert({
                user_id: user.id,
                prompt,
                title: "NYC Weekend Food Picks",
                content: text,
            })
            .select("id")
            .single();

        if (saveError || !generation) {
            console.error("Saving generation failed:", saveError);
            return NextResponse.json(
                { error: "Could not save recommendations. Please try again." },
                { status: 500 }
            );
        }

        return NextResponse.json({ id: generation.id, text });
    } catch (error) {
        console.error("Gemini request failed:", error);
        return NextResponse.json(
            { error: "Gemini request failed" },
            { status: 502 }
        );
    }
}

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
        }

        const { data: generations, error: loadError } = await supabase
            .from("generations")
            .select("id, title, prompt, content, created_at")
            .order("created_at", { ascending: false })
            .limit(20);

        if (loadError) {
            console.error("Loading recommendations failed:", loadError);
            return NextResponse.json(
                { error: "Could not load recommendations." },
                { status: 500 }
            );
        }

        if (!generations?.length) {
            return NextResponse.json({ generations: [] });
        }

        const { data: votes, error: voteError } = await supabase
            .from("votes")
            .select("generation_id, vote")
            .eq("user_id", user.id)
            .in("generation_id", generations.map((item) => item.id));

        if (voteError) {
            console.error("Loading ratings failed:", voteError);
            return NextResponse.json(
                { error: "Could not load ratings." },
                { status: 500 }
            );
        }

        return NextResponse.json({
            generations: generations.map((item) => ({
                ...item,
                myVote: votes?.find((vote) => vote.generation_id === item.id)?.vote ?? null,
            })),
        });
    } catch (error) {
        console.error("Loading feed failed:", error);
        return NextResponse.json(
            { error: "Could not load recommendations." },
            { status: 500 }
        );
    }
}