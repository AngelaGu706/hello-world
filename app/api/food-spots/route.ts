import { ApiError, GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { encodePickContent } from "@/utils/food-pick";

type GeneratedPick = {
    title: string;
    content: string;
};

function stripCodeFence(text: string) {
    const trimmed = text.trim();

    if (!trimmed.startsWith("```")) {
        return trimmed;
    }

    return trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
}

function parseGeneratedPick(text: string): GeneratedPick {
    const cleaned = stripCodeFence(text);

    try {
        const parsed = JSON.parse(cleaned);
        if (
            typeof parsed.title === "string" && parsed.title.trim() &&
            typeof parsed.content === "string" && parsed.content.trim()
        ) {
            return {
                title: parsed.title.trim().slice(0, 90),
                content: typeof parsed.area === "string" && typeof parsed.food === "string"
                    ? encodePickContent({
                        area: parsed.area.trim().slice(0, 70),
                        food: parsed.food.trim().slice(0, 50),
                        recommendation: parsed.content.trim().slice(0, 1200),
                    })
                    : parsed.content.trim().slice(0, 1200),
            };
        }
    } catch {
        // Fall back to readable text if Gemini returns prose instead of JSON.
    }

    const lines = cleaned.split("\n").map((line) => line.trim()).filter(Boolean);
    const firstLine = lines[0]?.replace(/^#+\s*/, "").replace(/^\*\*|\*\*$/g, "");

    return {
        title: (firstLine || "NYC Food Pick").slice(0, 90),
        content: cleaned.slice(0, 1200),
    };
}

export async function POST(request: Request) {
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
        const body = await request.json().catch(() => null);
        const userPrompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

        if (userPrompt.length < 3) {
            return NextResponse.json(
                { error: "Please enter what kind of NYC food you want." },
                { status: 400 }
            );
        }

        if (userPrompt.length > 200) {
            return NextResponse.json(
                { error: "Please keep the prompt under 200 characters." },
                { status: 400 }
            );
        }

        const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
                timeout: 15000,
                retryOptions: {
                    attempts: 3,
                    initialDelay: 1,
                    maxDelay: 2,
                    httpStatusCodes: [408, 500, 502, 503, 504],
                },
            },
        });
        const model = "gemini-3.1-flash-lite";
        const prompt = `
You are writing for NYC FOOD SPOTS, a student-friendly food discovery app.

User request: ${userPrompt}

Generate one NYC food pick. Return only valid JSON with:
- "title": a clear title naming the restaurant or food pick, at most 5 words. Avoid slogans and promotional wording.
- "area": one specific NYC neighborhood or area, at most 5 words
- "food": the food type, at most 3 words, such as "Dumplings" or "Pizza"
- "content": 1-2 short sentences, at most 30 words total. Say what to order and give one concrete reason it fits the request. Wrap exactly one dish or drink name (at most 4 words) in Markdown **bold**. No other emphasis, headings, lists, introduction, or extra tips. Do not repeat the title or metadata.

Do not mention that you are an AI. Do not invent prices or claim live wait times, live hours, or guaranteed availability.
`;

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseJsonSchema: {
                    type: "object",
                    properties: {
                        title: { type: "string", maxLength: 70 },
                        area: { type: "string", maxLength: 70 },
                        food: { type: "string", maxLength: 50 },
                        content: { type: "string", maxLength: 240 },
                    },
                    required: ["title", "area", "food", "content"],
                },
            },
        });
        const text = response.text;

        if (!text?.trim()) {
            throw new Error("Gemini returned no text");
        }

        const pick = parseGeneratedPick(text);

        const { data: generation, error: saveError } = await supabase
            .from("generations")
            .insert({
                user_id: user.id,
                prompt: userPrompt,
                title: pick.title,
                content: pick.content,
            })
            .select("id, prompt, title, content")
            .single();

        if (saveError || !generation) {
            console.error("Saving generation failed:", saveError);
            return NextResponse.json(
                { error: "Could not save recommendations. Please try again." },
                { status: 500 }
            );
        }

        return NextResponse.json(generation);
    } catch (error) {
        if (error instanceof ApiError) {
            console.error("Gemini request failed:", { status: error.status });

            if (error.status === 429) {
                return NextResponse.json(
                    { error: "The recommendation limit has been reached. Please try again later." },
                    { status: 429 }
                );
            }

            if (error.status === 503 || error.status === 500 || error.status === 502 || error.status === 504) {
                return NextResponse.json(
                    { error: "Food recommendations are temporarily busy. Please try again in a moment." },
                    { status: 503 }
                );
            }

            if (error.status === 400 || error.status === 401 || error.status === 403 || error.status === 404) {
                return NextResponse.json(
                    { error: "The recommendation service needs a configuration check. Please contact the app owner." },
                    { status: 502 }
                );
            }
        }

        return NextResponse.json(
            { error: "Could not generate a food pick. Please try again." },
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

        const { data: ratings, error: voteError } = await supabase
            .rpc("get_generation_ratings", {
                generation_ids: generations.map((item) => item.id),
            });

        if (voteError?.code === "PGRST202" || voteError?.code === "42883") {
            const { data: ownVotes, error: ownVoteError } = await supabase
                .from("votes")
                .select("generation_id, vote")
                .eq("user_id", user.id)
                .in("generation_id", generations.map((item) => item.id));

            if (ownVoteError) {
                return NextResponse.json({ error: "Could not load ratings." }, { status: 500 });
            }

            return NextResponse.json({
                generations: generations.map((item) => ({
                    ...item,
                    myVote: ownVotes?.find((vote) => vote.generation_id === item.id)?.vote ?? null,
                    upCount: null,
                    downCount: null,
                })),
            });
        }

        if (voteError) {
            console.error("Loading ratings failed:", voteError);
            return NextResponse.json(
                { error: "Could not load ratings." },
                { status: 500 }
            );
        }

        return NextResponse.json({
            generations: generations.map((item) => {
                const rating = ratings?.find((rating: { generation_id: string }) => rating.generation_id === item.id);
                return {
                    ...item,
                    myVote: rating?.my_vote ?? null,
                    upCount: Number(rating?.up_count ?? 0),
                    downCount: Number(rating?.down_count ?? 0),
                };
            }),
        });
    } catch (error) {
        console.error("Loading feed failed:", error);
        return NextResponse.json(
            { error: "Could not load recommendations." },
            { status: 500 }
        );
    }
}
