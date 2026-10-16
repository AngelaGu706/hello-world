import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { decodePickContent } from "@/utils/food-pick";
import { lookupRestaurant } from "@/utils/restaurant-location";

// Best-effort per-instance burst protection; set a provider quota for a global spend cap.
const requests = new Map<string, { count: number; until: number }>();
function allowLookup(id: string) {
    const now = Date.now();
    for (const [key, value] of requests) if (value.until <= now) requests.delete(key);
    const bucket = requests.get(id) ?? { count: 0, until: now + 60000 };
    if (bucket.count >= 30 || (!requests.has(id) && requests.size >= 5000)) return false;
    bucket.count++;
    requests.set(id, bucket);
    return true;
}

export async function POST(request: Request) {
    const reply = (body: object, status = 200) => NextResponse.json(body, {
        status, headers: { "Cache-Control": "private, no-store" },
    });
    try {
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return reply({ error: "Please sign in first." }, 401);
        const body = await request.json().catch(() => null);
        // Accept only a saved pick ID. User coordinates are never part of this API.
        if (!body || Object.keys(body).length !== 1 || typeof body.generationId !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.generationId)) {
            return reply({ error: "Choose a saved food pick." }, 400);
        }
        const key = process.env.GOOGLE_PLACES_API_KEY;
        if (!key) return reply({ error: "Restaurant distances aren’t set up yet." }, 503);
        if (!allowLookup(user.id)) return reply({ error: "Please wait a minute before checking more distances." }, 429);
        const { data: pick, error: loadError } = await supabase.from("generations")
            .select("title, content").eq("id", body.generationId).single();
        if (loadError || !pick) return reply({ error: "This food pick is unavailable." }, 404);
        const { area } = decodePickContent(pick.content);
        if (!area.trim() || !pick.title.trim()) return reply({ restaurant: null });
        const restaurant = await lookupRestaurant(pick.title, area, key, request.signal);
        return reply({ restaurant });
    } catch {
        // Never return/log provider payloads, credentials, or precise positions.
        return reply({ error: "Couldn’t check restaurant distance. Please try again." }, 502);
    }
}
