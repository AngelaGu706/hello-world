import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import FoodBucketList from "./food-bucket-list";

export default async function BucketListPage() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) redirect("/");
    return <FoodBucketList />;
}
