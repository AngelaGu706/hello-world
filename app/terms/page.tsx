import Link from "next/link";

export default function TermsPage() {
    return <main className="location-policy">
        <Link href="/dashboard">Back to NYC FOOD SPOTS</Link>
        <h1>About distances</h1>
        <p>Distances are estimates measured in a straight line, not walking distances or directions. They start from the approximate center of the area you select. Neighborhood centers are public reference points, not your actual location. This feature does not access your device location.</p>
        <p>Restaurant coordinates and addresses come from the NYC Department of Health’s <a href="https://data.cityofnewyork.us/d/43nn-pn8j" target="_blank" rel="noopener noreferrer">restaurant inspection dataset</a>. These records are not live opening-status information. Check the address and current availability before making plans. Missing coordinates, ambiguous branches, unfamiliar neighborhood labels, or data-service failures may make a distance unavailable.</p>
        <p>Area checks and calculated centers use the NYC Department of City Planning’s <a href="https://data.cityofnewyork.us/d/9nt8-h7nd" target="_blank" rel="noopener noreferrer">2020 Neighborhood Tabulation Areas</a>. These statistical areas roughly correspond to neighborhoods and do not define their exact boundaries. Some selections combine adjacent named areas, so center-based distances are approximate.</p>
        <Link href="/privacy">Location privacy</Link>
    </main>;
}
