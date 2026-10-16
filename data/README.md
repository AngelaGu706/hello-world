# Official neighborhood geography

`nyc-neighborhoods.json` contains the 197 residential 2020 Neighborhood Tabulation Areas from NYC Department of City Planning, retrieved 2026-10-16. Only ID, name, borough and the original WGS84 multipolygon vertices are retained. Source: https://data.cityofnewyork.us/d/9nt8-h7nd .

These are statistical reporting areas; NYC DCP says they roughly correspond to neighborhoods but do not definitively represent them. We use them as conservative area checks, not exact street-level neighborhood claims.

`utils/neighborhood-centers.ts` contains area-weighted polygon centroids of the listed NTA unions (holes subtracted). The union codes are recorded next to each center, making the calculation reproducible. These approximate area centers are public reference points, not restaurant coordinates or user locations. The full polygon file is only imported by server lookup code, not client components.

Broader selections: Upper West Side combines its three named NTAs; Midtown combines Midtown-Times Square and East Midtown-Turtle Bay; Williamsburg combines Williamsburg, South Williamsburg and East Williamsburg; Astoria combines its four named NTAs; Chinatown uses Chinatown-Two Bridges; Flushing uses Flushing-Willets Point. The UI explains these approximations.
