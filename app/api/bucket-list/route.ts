import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const fields = "generation_id, status, created_at, generation:generations(id, title, prompt, content)";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handle(method: "GET" | "POST" | "PATCH" | "DELETE", request?: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

        if (method === "GET") {
            const { data, error } = await supabase.from("food_bucket_list")
                .select(fields).eq("user_id", user.id).order("created_at", { ascending: false });
            if (error) throw error;
            return NextResponse.json({ items: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
        }

        const body = await request!.json().catch(() => null);
        const generationId = body?.generationId;
        if (typeof generationId !== "string" || !uuid.test(generationId)) {
            return NextResponse.json({ error: "Invalid food pick." }, { status: 400 });
        }
        if (method === "PATCH" && body.status !== "want_to_go" && body.status !== "been_there") {
            return NextResponse.json({ error: "Invalid bucket list status." }, { status: 400 });
        }

        if (method === "DELETE") {
            const { error } = await supabase.from("food_bucket_list").delete()
                .eq("user_id", user.id).eq("generation_id", generationId);
            if (error) throw error;
            return NextResponse.json({ removed: true });
        }

        if (method === "POST") {
            // Ignoring duplicates preserves a previously saved item's status and date.
            const { error } = await supabase.from("food_bucket_list").upsert({
                user_id: user.id, generation_id: generationId,
            }, { onConflict: "user_id,generation_id", ignoreDuplicates: true });
            if (error?.code === "23503") return NextResponse.json({ error: "This pick is no longer available." }, { status: 404 });
            if (error) throw error;
        } else {
            const { data, error } = await supabase.from("food_bucket_list").update({ status: body.status })
                .eq("user_id", user.id).eq("generation_id", generationId).select("generation_id").maybeSingle();
            if (error) throw error;
            if (!data) return NextResponse.json({ error: "This pick is no longer in your list. Refresh and try again." }, { status: 404 });
        }

        const { data, error } = await supabase.from("food_bucket_list").select(fields)
            .eq("user_id", user.id).eq("generation_id", generationId).single();
        if (error) throw error;
        return NextResponse.json({ item: data });
    } catch (error) {
        console.error("Bucket list request failed:", error);
        return NextResponse.json({ error: method === "GET" ? "Could not load your bucket list. Please try again." : "Could not update your bucket list. Please try again." }, { status: 500 });
    }
}

export async function GET() { return handle("GET"); }
export async function POST(request: Request) { return handle("POST", request); }
export async function PATCH(request: Request) { return handle("PATCH", request); }
export async function DELETE(request: Request) { return handle("DELETE", request); }
