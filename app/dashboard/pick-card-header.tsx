import { getPickCuisine } from "@/utils/food-pick";
import BookmarkButton from "./bookmark-button";

export default function PickCardHeader({ pick }: { pick: { id: string; title: string; content: string } }) {
    const cuisine = getPickCuisine(pick);
    return <div className="pick-card-header">
        {cuisine && <span className="pick-card-cuisine">{cuisine}</span>}
        <BookmarkButton generationId={pick.id} />
    </div>;
}
