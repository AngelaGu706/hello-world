import Link from "next/link";

export default function PrivacyPage() {
    return <main className="location-policy">
        <Link href="/dashboard">Back to NYC FOOD SPOTS</Link>
        <h1>Location privacy</h1>
        <p>Location is optional. We request browser location permission only when you choose “Use my location” or “Update my location.” You can keep using recommendations, ratings, and Your List without sharing it.</p>
        <p>Your coordinates stay in temporary browser memory to calculate approximate straight-line distances. This feature does not send them to our server, Google, or Supabase, and does not save them in browser storage. “Turn off,” leaving the dashboard, or reloading the page clears them. Cancelling a pending request ignores any later result; browser permissions can be changed in your browser’s site settings.</p>
        <p>After you enable location, our server sends the recommended restaurant’s name and neighborhood to Google Places to verify its location. Google receives the server request, not your coordinates. See the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>. Opening a Google Maps link connects your browser to Google and is covered by Google’s policies.</p>
        <p>This notice covers the optional distance feature. Existing sign-in, recommendations, ratings, and saved-list data continue to use the app’s existing services.</p>
        <Link href="/terms">Distance feature terms</Link>
    </main>;
}
