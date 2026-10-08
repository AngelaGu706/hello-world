import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import CommunityPicks from "./community-picks";

export default async function PicksPage() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        redirect("/");
    }

    return <CommunityPicks />;
}
