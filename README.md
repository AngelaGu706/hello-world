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

## Optional restaurant distances

The Discover result, Community Picks, and Your List share an opt-in **Use my location** action. It only calls `navigator.geolocation.getCurrentPosition` after a click, with a 10-second browser timeout and 15-second overall deadline. HTTPS or localhost is required. Denial, unavailable location, insecure context, and timeout show a retryable explanation; recommendation generation, ratings, saving, and sign-in do not depend on location.

### Setup

1. In a Google Cloud project, enable billing and **Places API (New)**. Create a separate server API key restricted to Places API (New). Set provider quotas and billing alerts to control costs; Text Search requests use the Pro fields. Follow https://developers.google.com/maps/documentation/places/web-service/get-api-key and the field/pricing information at https://developers.google.com/maps/documentation/places/web-service/text-search.
2. Add `GOOGLE_PLACES_API_KEY=your-server-key` to `.env.local`. In Vercel, add the same variable to the intended deployment environment and redeploy. Never use a `NEXT_PUBLIC_` prefix or reuse the Gemini key. A browser/referrer-restricted key will not work for server requests; use server/IP restrictions only if your hosting provides fixed egress IPs.
3. Restart the local server. On HTTPS/localhost, click **Use my location** and allow browser access. Confirm the distance text, source/address, and **Turn off** action. The existing Supabase variables and `GEMINI_API_KEY` are unchanged; no database migration is needed.

### Matching and privacy

`POST /api/restaurant-location` requires authentication and accepts only a saved `generationId`. It loads the restaurant name/neighborhood through the existing Supabase client and RLS, then queries Google Places. It does not accept user coordinates. Exact normalized name, operational status, a food venue type, NYC viewport, US/NY address, NYC locality/borough, a street address, and an exact neighborhood/sublocality component must all match. Multiple matching branches, paginated results, missing coordinates, missing neighborhood evidence, legacy picks without an area, and inconsistent matches return no distance. The Google address is shown so users can check the branch. Neighborhood labels can vary; a conservative unavailable result is expected for some valid restaurants. No fuzzy fallback, neighborhood centroid, or AI-generated coordinates are used.

Haversine runs in the browser using the verified venue coordinates and in-memory user coordinates. It rounds to tenths of a mile and labels the value as approximate straight-line distance, not walking distance. User coordinates are never rendered, sent to any endpoint, logged, saved to Supabase, or put in browser storage. Turning location off clears the position and unmounts place results; page reload or leaving the dashboard clears the position too. In-flight lookups abort when cards unmount. Google results are only held while displaying the card, without persistent/server caches. Provider errors, missing key, quota limits, and lookup timeouts stay local to distance UI with a Retry action.

The endpoint includes a best-effort 30 requests/minute per user burst limit per server instance. It is not a global billing cap on serverless deployments: configure Google Cloud quotas for that. Google Maps attribution and returned third-party attributions are displayed with each verified restaurant location. Public `/privacy` and `/terms` pages explain this feature and link Google's terms/privacy policy. Review your full app policies before launch: https://developers.google.com/maps/documentation/places/web-service/policies.

### Verification

Run `npm test`, `npm run lint`, and `npm run build`. Distance tests cover known Haversine results, numerical edge cases, geolocation success/denial/unavailable/timeout, strict venue/branch validation, authenticated lookup boundaries, missing key, provider errors, and non-persistence. Manually check permissions and responsive UI on your deployed HTTPS domain after setting the key. Live provider success requires a configured key.
