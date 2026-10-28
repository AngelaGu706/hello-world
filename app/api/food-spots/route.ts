import { FoodTrace, TracePersistenceError } from "@/utils/food-trace";
import { ApiError, GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { decodePickContent, encodePickContent } from "@/utils/food-pick";
import { cuisines, isCuisine } from "@/utils/food-cuisines";
import { isNeighborhood } from "@/utils/food-neighborhoods";
import { loadGenerationRatings } from "@/utils/supabase/generation-ratings";
import { recentRestaurantNames, shouldTryDifferentRestaurant, varietyInstructions } from "@/utils/recommendation-variety";

type GeneratedPick = {
    title: string;
    content: string;
};

class NeighborhoodMatchError extends Error { name = "NeighborhoodMatchError"; }

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
                        ...((isCuisine(parsed.cuisine) || parsed.cuisine === "Other") ? { cuisine: parsed.cuisine } : {}),
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

    let trace: FoodTrace | undefined;
    try {
        const body = await request.json().catch(() => null);
        const userPrompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
        if (body?.cuisine != null && !isCuisine(body.cuisine)) {
            return NextResponse.json({ error: "Please choose a supported cuisine." }, { status: 400 });
        }
        const cuisine = isCuisine(body?.cuisine) ? body.cuisine : null;
        if (body?.neighborhood != null && !isNeighborhood(body.neighborhood)) {
            return NextResponse.json({ error: "Please choose a supported neighborhood." }, { status: 400 });
        }
        const neighborhood = isNeighborhood(body?.neighborhood) ? body.neighborhood : null;

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

        trace = await FoodTrace.begin(supabase, userPrompt, cuisine, neighborhood);

        // Limit history to this user's recent picks. History is optional: a read
        // failure must not stop an otherwise valid recommendation.
        let recentNames: string[] = [];
        try {
            const { data: recent, error } = await supabase.from("generations")
                .select("title").eq("user_id", user.id)
                .order("created_at", { ascending: false }).limit(20);
            if (!error) recentNames = recentRestaurantNames(recent ?? []);
        } catch {
            // Continue without history if it is temporarily unavailable.
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
${cuisine ? `Selected cuisine: ${cuisine}. Recommend a restaurant serving this cuisine. This choice takes priority over any conflicting cuisine in the user request.` : ""}
${neighborhood ? `Selected neighborhood: ${neighborhood}. Choose a restaurant whose actual location you confidently know is in this neighborhood. This choice takes priority over any conflicting location in the user request. Never relabel a restaurant from another neighborhood to make it fit. Return the restaurant's real neighborhood in "area"; use an empty "area" if you cannot find a confident match. It is better to return no match than invent a location.` : "Use a location from the user request when provided; otherwise search across NYC. The user's current location is not available."}
${varietyInstructions(recentNames)}

Generate one NYC food pick. Return only valid JSON with:
- "title": the actual restaurant name only, at most 70 characters. No dish names, slogans, or promotional wording.
- "area": one specific NYC neighborhood or area, at most 5 words
- "cuisine": classify the recommended restaurant as one of ${[...cuisines, "Other"].join(", ")}.${cuisine ? ` Must be "${cuisine}".` : " Use Other for mixed or other cuisines."}
- "food": one specific dish or drink to recommend, at most 6 words and 50 characters. Plain text, without Markdown. Match any explicitly requested food and dietary needs: a request for dumplings must recommend a dumpling dish, not an egg roll or another substitute. This appears in a separate recommendation block, so choose an actual menu item rather than a broad category like "Brunch" or "French food".
- "content": one short, natural English sentence or phrase, 6-12 words. Suggest a dining occasion that matches the user's plan, rather than reviewing the venue. The dish is shown separately: do not repeat its name, the restaurant name, neighborhood, or cuisine. No Markdown, emojis, headings, lists, introduction, or extra tips.

Voice: warm and understated, like a friend suggesting a plan. Say less and use plain words. Avoid ad copy, poetic slogans, repeated sentence templates, and strings of generic adjectives. Do not start with "Order the", "Try the", or "This spot". Avoid "provides", "offers", "experience", "perfect", "quintessential", "hidden gem", "budget-friendly", and "inviting atmosphere". Do not tell the user to save, book, or visit; the app already provides those actions.

Match the user's actual occasion instead of assigning everyone a slow weekend brunch. For tone only: "A quick dumpling stop between classes." or "For a slow weekend morning and a catch-up over brunch." Adapt the wording to each request; do not copy a fixed template. Keep only the context the user supplies; do not add companions, study plans, or other activities they did not mention. Describe the occasion as an idea, not as a factual claim about decor, service, comfort, or noise levels.

Treat the requested budget as a selection constraint, not proof of the price. Never promise a meal, total bill, or "tab" will stay below that budget. Do not invent menu items, exact prices, reviews, atmosphere, live wait times, live hours, or guaranteed availability. Do not mention that you are an AI.
Choose a venue and dish suited to the requested meal and budget. Do not recommend a dinner-only or expensive dish for an affordable brunch request. Accuracy and a good fit take priority over variety.
`;

        const settings = {
                    responseMimeType: "application/json",
                    responseJsonSchema: {
                        type: "object",
                        properties: {
                            title: { type: "string", maxLength: 70 },
                            area: { type: "string", maxLength: 70 },
                            food: { type: "string", maxLength: 50 },
                            cuisine: { type: "string", enum: cuisine ? [cuisine] : [...cuisines, "Other"] },
                            content: { type: "string", maxLength: 240 },
                        },
                        required: ["title", "area", "food", "cuisine", "content"],
                    },
                };
        async function generatePick(contents: string, kind: "recommendation" | "variety_retry") {
            return trace!.step(model, contents, { ...settings, sdk_retry_attempts: 3 }, kind,
                () => ai.models.generateContent({ model, contents, config: settings }), (text) => {
            const pick = parseGeneratedPick(text);
            if (cuisine && decodePickContent(pick.content).cuisine !== cuisine) {
                throw new Error("The recommendation did not match the selected cuisine");
            }
            if (neighborhood && decodePickContent(pick.content).area !== neighborhood) {
                throw new NeighborhoodMatchError(`Couldn’t find a match in ${neighborhood}. Try another neighborhood or adjust your preferences.`);
            }
            return pick;
            });
        }

        let selected = await generatePick(prompt, "recommendation");
        if (shouldTryDifferentRestaurant(selected.pick.title, recentNames, userPrompt)) {
            try {
                // At most one extra generation; save only the final pick.
                selected = await generatePick(`${prompt}\nThe previous candidate was ${JSON.stringify(selected.pick.title)}. Choose a different restaurant that meets the same request.`, "variety_retry");
            } catch (error) {
                if (error instanceof TracePersistenceError) throw error;
                // Keep the valid first pick if finding an alternative fails.
            }
        }

        const generation = await trace.complete(selected.stepId, selected.pick,
            neighborhood ? `${userPrompt}\nNeighborhood: ${neighborhood}` : userPrompt);

        return NextResponse.json(generation);
    } catch (error) {
        if (trace) {
            try { await trace.fail(error); }
            catch { console.error("Could not finish generation trace", { requestId: trace.id }); }
        }
        if (error instanceof TracePersistenceError) {
            return NextResponse.json({ error: error.message, request_id: trace?.id }, { status: 503 });
        }
        if (error instanceof NeighborhoodMatchError) {
            return NextResponse.json({ error: error.message }, { status: 422 });
        }
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

        const { ratings, ratingsError } = await loadGenerationRatings(
            supabase, generations.map((item) => item.id), user.id,
        );
        return NextResponse.json({
            generations: generations.map((item) => ({ ...item, ...ratings.get(item.id)! })),
            ratingsError,
        }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        console.error("Loading feed failed:", error);
        return NextResponse.json(
            { error: "Could not load recommendations." },
            { status: 500 }
        );
    }
}
