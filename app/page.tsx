import { createClient } from "@supabase/supabase-js";
import LoginButton from "./login-button";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export const dynamic = "force-dynamic";

export default async function Home() {
    const { data: items, error } = await supabase
        .from("items")
        .select("*")
        .order("id");

    if (error) {
        return <main>Error loading items.</main>;
    }

    return (
        <main>
            <LoginButton />
            <h1>Items</h1>

            <ul>
                {items?.map((item) => (
                    <li key={item.id}>{item.name}</li>
                ))}
            </ul>
        </main>
    );
}