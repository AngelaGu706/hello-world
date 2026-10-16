import Link from "next/link";

export default function PrivacyPage() {
    return <main className="location-policy">
        <Link href="/dashboard">Back to NYC FOOD SPOTS</Link>
        <h1>Location privacy</h1>
        <p>Choose a neighborhood area center to see approximate distances. This feature does not request or access your device’s current location.</p>
        <p>Your selected area stays in temporary browser memory. It is separate from the neighborhood where you want to find a restaurant. The distance origin is not sent to our server or NYC Open Data, saved to Supabase, or written to browser storage. Clear the selection, reload the page, or leave the dashboard to reset it.</p>
        <p>After you choose a distance origin, our server looks up the recommended restaurant’s name and borough in <a href="https://data.cityofnewyork.us/d/43nn-pn8j" target="_blank" rel="noopener noreferrer">NYC Open Data</a> and checks the returned address and coordinates against the recommendation’s area. Only public restaurant data is cached, for up to 24 hours. No Google Places key or Google Cloud billing is used.</p>
        <p>This notice covers the optional distance feature. Existing sign-in, recommendations, ratings, and saved-list data continue to use the app’s existing services.</p>
        <Link href="/terms">Distance feature terms</Link>
    </main>;
}
