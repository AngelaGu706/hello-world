import Image from "next/image";

type Props = {
    image: string;
    eyebrow: string;
    title: string;
    subtitle?: string;
    heading?: "h1" | "h2";
    quality?: number;
};

export default function PageCover({ image, eyebrow, title, subtitle, heading: Heading = "h1", quality = 75 }: Props) {
    return <header className="food-cover">
        <Image src={image} alt="" fill sizes="(max-width: 1160px) 100vw, 1096px" quality={quality} preload className="food-cover-image" />
        <div className="food-cover-content">
            <p className="food-cover-eyebrow">{eyebrow}</p>
            <Heading>{title}</Heading>
            {subtitle && <p className="food-cover-subtitle">{subtitle}</p>}
        </div>
    </header>;
}
