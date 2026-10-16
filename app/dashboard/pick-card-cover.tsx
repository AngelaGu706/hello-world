import Image from "next/image";
import { getPickCuisine } from "@/utils/food-pick";
import BookmarkButton from "./bookmark-button";

export default function PickCardCover({ pick }: { pick: { id: string; title: string; content: string } }) {
    const cuisine = getPickCuisine(pick);
    return <div className="pick-card-cover">
        <Image src="/your-list-cafe.webp" alt="" fill
            sizes="(max-width: 700px) 100vw, (max-width: 1160px) 50vw, 550px"
            className="pick-card-cover-image" />
        {cuisine && <span className="pick-card-cuisine">{cuisine}</span>}
        <BookmarkButton generationId={pick.id} />
        <span className="pick-card-image-note" title="AI-generated atmosphere image, not a photo of this restaurant or dish">Atmosphere image</span>
    </div>;
}
