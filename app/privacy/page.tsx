import Link from "next/link";

export default function PrivacyPage() {
    return <main className="location-policy">
        <Link href="/dashboard">Back to NYC FOOD SPOTS</Link>
        <h1>Location privacy</h1>
        <p>Choose a neighborhood area center to see distances without granting location permission. Your choice stays in temporary browser memory. It is separate from the neighborhood where you want to find a restaurant.</p>
        <p>Current location is optional. We request browser location permission only when you choose “Use my location” or “Update my location.” You can keep using recommendations, ratings, and Your List without it.</p>
        <p>Your coordinates stay in temporary browser memory to calculate approximate straight-line distances. This feature does not send them to our server, NYC Open Data, or Supabase, and does not save them in browser storage. “Turn off,” leaving the dashboard, or reloading the page clears the distance origin. Cancelling a pending request or choosing an area center ignores any later position result; browser permissions can be changed in your browser’s site settings.</p>
        <p>After you choose a distance origin, our server looks up the recommended restaurant’s name and borough in <a href="https://data.cityofnewyork.us/d/43nn-pn8j" target="_blank" rel="noopener noreferrer">NYC Open Data</a> and checks the returned address and coordinates against the recommendation’s area. Only public restaurant data is cached, for up to 24 hours. No Google Places key or Google Cloud billing is used.</p>
        <p>This notice covers the optional distance feature. Existing sign-in, recommendations, ratings, and saved-list data continue to use the app’s existing services.</p>
        <Link href="/terms">Distance feature terms</Link>
    </main>;
}
