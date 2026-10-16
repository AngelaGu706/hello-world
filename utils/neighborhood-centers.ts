import type { Neighborhood } from "./food-neighborhoods";

// Planar area-weighted centroids derived from NYC DCP NTA 2020 polygons.
// Approximate statistical areas, not definitive neighborhood boundaries.
// Source: https://data.cityofnewyork.us/d/9nt8-h7nd (retrieved 2026-10-16).
export const neighborhoodCenters = {
    "Morningside Heights": {
        "latitude": 40.8094585,
        "longitude": -73.9617644,
        "ntaIds": [
            "MN0901"
        ]
    },
    "Upper West Side": {
        "latitude": 40.7867725,
        "longitude": -73.9763835,
        "ntaIds": [
            "MN0701",
            "MN0702",
            "MN0703"
        ]
    },
    "Midtown": {
        "latitude": 40.7572199,
        "longitude": -73.9770407,
        "ntaIds": [
            "MN0502",
            "MN0604"
        ]
    },
    "West Village": {
        "latitude": 40.7348096,
        "longitude": -74.0058927,
        "ntaIds": [
            "MN0203"
        ]
    },
    "Chinatown": {
        "latitude": 40.7128584,
        "longitude": -73.9936635,
        "ntaIds": [
            "MN0301"
        ]
    },
    "Williamsburg": {
        "latitude": 40.7121956,
        "longitude": -73.9463017,
        "ntaIds": [
            "BK0102",
            "BK0103",
            "BK0104"
        ]
    },
    "Astoria": {
        "latitude": 40.7705385,
        "longitude": -73.9120977,
        "ntaIds": [
            "QN0101",
            "QN0102",
            "QN0103",
            "QN0104"
        ]
    },
    "Flushing": {
        "latitude": 40.7602131,
        "longitude": -73.8315837,
        "ntaIds": [
            "QN0707"
        ]
    }
} as const satisfies Record<Neighborhood, { latitude: number; longitude: number; ntaIds: readonly string[] }>;
