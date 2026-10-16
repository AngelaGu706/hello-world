This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Optional restaurant distances (no Google billing)

No Google Places API key, Google Cloud billing account, or Supabase migration is needed. The existing Supabase and Gemini settings remain unchanged. In Discover, Community Picks, and Your List, choose **Distance from** → one of eight neighborhood area centers. This origin is separate from the Neighborhood selector used to choose where recommendations are generated. Alternatively, click **Use my location** for optional browser geolocation (HTTPS/localhost, interaction only). Denial, insecure origin, unsupported browsers, and timeout do not block the core app or manual area selection.

### Sources and matching

Restaurant coordinates: NYC DOHMH Restaurant Inspection Results, https://data.cityofnewyork.us/d/43nn-pn8j . Public Socrata queries need no API key and may be rate limited. The server queries a bounded set of distinct establishment/address/coordinate rows by a safe name token and borough, then verifies the full normalized name, CAMIS establishment ID, street address, ZIP, finite coordinates, correct borough, and containment in the recommendation area's official NTA polygon(s). Repeated citations are deduplicated. Conflicting records, multiple branches in the area, incomplete result sets, unknown area labels, and missing coordinates produce **Distance unavailable**. No AI coordinates, neighborhood-centroid substitutes for restaurants, or fuzzy branch guessing are used. The confirmed restaurant address and dataset date are displayed. Inspection records do not guarantee live opening status.

Area geometry: NYC DCP 2020 Neighborhood Tabulation Areas, https://data.cityofnewyork.us/d/9nt8-h7nd , downloaded 2026-10-16. Original polygons are stored in `data/nyc-neighborhoods.json` and imported only by server code. They are statistical approximations, not definitive neighborhood boundaries. `utils/neighborhood-centers.ts` records calculated area-weighted polygon centroids and the exact NTA IDs used. See `data/README.md` for broader neighborhood selections. Unknown recommendation labels conservatively return no distance unless they exactly match an official NTA name. The eight selectable origins are supported explicitly.

### Privacy and reliability

Haversine calculates miles in the browser, rounded to tenths and labelled approximate straight-line distance, not walking distance. For manual origins, the card explicitly names the approximate area center; for GPS it says current location. The lookup endpoint accepts only an authenticated saved `generationId`, loads it through existing RLS, and never receives user coordinates or the selected distance origin. Neither is rendered as precise coordinates, sent to external services, logged, or persisted. Turning off, reloading, or leaving the dashboard clears the origin. Cancelling/choosing an area invalidates late geolocation callbacks.

Public restaurant query results can be cached by Next.js for 24 hours to reduce load on NYC's shared API. API responses to the browser remain private/no-store. Lookups abort on card unmount and have a deadline. A best-effort per-user 30/minute server-instance limit protects the shared endpoint. Data outages or rate limiting show a retryable distance error, while generation, ratings, auth, and bucket lists keep working. Existing `GOOGLE_PLACES_API_KEY` variables, if any, are unused and can be removed by the owner. `/privacy` and `/terms` describe the public-data implementation.

### Verification

Run `npm test`, `npm run lint`, and `npm run build`. Tests include known Haversine values, numerical edges, geolocation errors/deadlines, polygon holes/edges/islands, all eight source-derived centers, genuine public restaurant fixtures, branch/record ambiguity, bounded injection-safe public queries, endpoint authentication and coordinate rejection, no-key operation, and existing app regressions. Real public lookups were verified for Buvette (West Village), Koronet Pizza (Morningside Heights), and Jack's Wife Freda (West Village). Browser tests exercise manual origins, switching origins without retransmitting coordinates, location opt-in, denial/retry, reset, and mobile fit.
