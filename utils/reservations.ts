import { decodePickContent } from "./food-pick";

type ReservationVenue = {
    names: readonly string[];
    area: string;
    url: string;
    provider: "Resy" | "OpenTable";
};

// Checked 2026-10-14 against the venue's official site or booking profile.
// Match name AND neighborhood; an unrecognized branch uses search instead.
const venues: readonly ReservationVenue[] = [
    {
        names: ["buvette", "buvette nyc"], area: "west village", provider: "Resy",
        url: "https://resy.com/cities/new-york-ny/venues/buvette-nyc",
        // Source: https://resy.com/cities/new-york-ny/venues/buvette-nyc
    },
    {
        names: ["joseph leonard"], area: "west village", provider: "OpenTable",
        url: "https://www.opentable.com/r/joseph-leonard-reservations-new-york?lang=en-US&restref=226681",
        // Official Reserve link: https://www.josephleonard.com/
    },
    {
        names: ["jacks wife freda"], area: "west village", provider: "Resy",
        url: "https://resy.com/cities/new-york-ny/venues/jacks-wife-freda-west-village",
        // Official West Village link: https://jackswifefreda.com/locations/
    },
];

function normalize(value: string) {
    return value.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "")
        .replace(/[\u2019']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function getReservationLink(pick: { title: string; content: string }) {
    const { area } = decodePickContent(pick.content);
    const name = normalize(pick.title.match(/\bat\s+(.+)$/i)?.[1] ?? pick.title);
    const venue = venues.find(venue => venue.names.includes(name) && venue.area === normalize(area));
    if (venue) return { href: venue.url, label: "Check reservations", destination: venue.provider, verified: true };

    // Keep arbitrary/AI-generated titles inside an encoded query, never a URL.
    const query = [pick.title.trim(), area.trim(), "NYC restaurant reservations"].filter(Boolean).join(" ");
    return {
        href: `https://www.google.com/search?${new URLSearchParams({ q: query })}`,
        label: "Find reservation options", destination: "Web search", verified: false,
    };
}
