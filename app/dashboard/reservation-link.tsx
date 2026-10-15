import { ArrowUpRight, CalendarDays } from "lucide-react";
import { getReservationLink } from "@/utils/reservations";

export default function ReservationLink({ pick }: { pick: { title: string; content: string } }) {
    const reservation = getReservationLink(pick);
    return <a href={reservation.href} className="community-reservation-link" target="_blank" rel="noopener noreferrer"
        aria-label={`${reservation.label} for ${pick.title} (opens in a new tab)`}
        title={`${reservation.destination} · opens in a new tab`}>
        <span><CalendarDays size={16} aria-hidden="true" />{reservation.label}</span><ArrowUpRight size={16} aria-hidden="true" />
    </a>;
}
