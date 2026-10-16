import Link from "next/link";

export default function TermsPage() {
    return <main className="location-policy">
        <Link href="/dashboard">Back to NYC FOOD SPOTS</Link>
        <h1>Distance feature terms</h1>
        <p>Distances are estimates measured in a straight line, not walking distances or directions. Browser location accuracy varies. Confirm the restaurant’s address before making plans. When we cannot confidently match a restaurant and neighborhood, a distance is unavailable.</p>
        <p>Restaurant location information comes from Google Maps. Use of this feature is also subject to the <a href="https://maps.google.com/help/terms_maps/" target="_blank" rel="noopener noreferrer">Google Maps/Google Earth Additional Terms of Service</a> and the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.</p>
        <Link href="/privacy">Location privacy</Link>
    </main>;
}
