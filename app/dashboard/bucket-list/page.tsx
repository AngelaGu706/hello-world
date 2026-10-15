import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import FoodBucketList from "./food-bucket-list";

export const metadata = { title: "Your List | NYC FOOD SPOTS" };

export default async function BucketListPage() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) redirect("/");
    return <FoodBucketList />;
}
