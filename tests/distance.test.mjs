import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load } from './load-source.mjs';

const { haversineMiles, formatDistance, isCoordinates } = load('utils/distance.ts');
const { selectVerifiedRestaurant, lookupRestaurant } = load('utils/restaurant-location.ts');

test('haversine returns known quarter-equator distance, zero, symmetry and finite antipodes', () => {
    const zero = { latitude: 0, longitude: 0 };
    const quarter = { latitude: 0, longitude: 90 };
    assert.ok(Math.abs(haversineMiles(zero, quarter) - 6218.407) < 0.01);
    assert.equal(haversineMiles(zero, zero), 0);
    assert.equal(haversineMiles(zero, quarter), haversineMiles(quarter, zero));
    assert.ok(Number.isFinite(haversineMiles(zero, { latitude: 0, longitude: 180 })));
    assert.equal(formatDistance(0.04), 'Less than 0.1 miles away');
    assert.equal(formatDistance(0.44), 'About 0.4 miles away');
    assert.equal(isCoordinates({ latitude: NaN, longitude: 0 }), false);
    assert.throws(() => haversineMiles(zero, { latitude: 91, longitude: 0 }));
});

// Genuine NYC DOHMH row, retrieved 2026-10-16; mutations below are test-only.
const sourceRow = JSON.parse(fs.readFileSync(new URL('./fixtures/restaurant-location.json', import.meta.url), 'utf8'));
const fixture = () => structuredClone(sourceRow);
const { pointInRing, pointInArea, areasForName } = load('utils/neighborhood-geography.ts');
const { neighborhoodCenters } = load('utils/neighborhood-centers.ts');

test('all eight origin centers derive from supported official areas and lie inside their unions', () => {
    assert.equal(Object.keys(neighborhoodCenters).length, 8);
    for (const [name, center] of Object.entries(neighborhoodCenters)) {
        assert.ok(isCoordinates(center), name);
        assert.ok(areasForName(name).some(area => pointInArea(center, area.polygons)), name);
    }
});

test('polygon containment handles concavity, holes, islands and boundary points', () => {
    const outer = [[0,0],[4,0],[4,4],[0,4],[0,0]];
    const hole = [[1,1],[2,1],[2,2],[1,2],[1,1]];
    assert.equal(pointInRing({latitude:3,longitude:3}, outer), true);
    assert.equal(pointInRing({latitude:2,longitude:0}, outer), true);
    assert.equal(pointInRing({latitude:5,longitude:2}, outer), false);
    assert.equal(pointInArea({latitude:1.5,longitude:1.5}, [[outer,hole]]), false);
    assert.equal(pointInArea({latitude:3,longitude:3}, [[outer,hole]]), true);
    assert.equal(pointInArea({latitude:3,longitude:3}, [[hole],[outer]]), true);
});

test('genuine Buvette data matches the name and West Village polygon, deduplicating citations', () => {
    const row = fixture();
    const result = selectVerifiedRestaurant([row, row], 'BUVETTE', 'West Village');
    assert.equal(result.recordId, row.camis);
    assert.equal(result.latitude, Number(row.latitude));
    assert.equal(result.longitude, Number(row.longitude));
    assert.equal(result.address, '42 GROVE STREET, Manhattan, NY 10014');
    assert.equal(result.sourceUrl, 'https://data.cityofnewyork.us/d/43nn-pn8j');
});

for (const [label, mutate] of [
    ['wrong name', row => { row.dba = 'Buvette London'; }],
    ['outside selected neighborhood', row => { row.latitude = '40.81'; row.longitude = '-73.96'; }],
    ['outside NYC', row => { row.latitude = '51.5'; }],
    ['missing coordinates', row => { delete row.latitude; }],
    ['empty coordinates', row => { row.latitude = ''; }],
    ['non-finite coordinates', row => { row.longitude = 'Infinity'; }],
    ['non-numeric coordinates', row => { row.latitude = 'unknown'; }],
    ['wrong borough', row => { row.boro = 'Brooklyn'; }],
    ['no street number', row => { row.building = ''; }],
    ['no street', row => { delete row.street; }],
    ['no ZIP', row => { delete row.zipcode; }],
    ['invalid establishment ID', row => { row.camis = 'unknown'; }],
]) {
    test(`unverified ${label} never produces a distance coordinate`, () => {
        const row = fixture(); mutate(row);
        assert.equal(selectVerifiedRestaurant([row], 'Buvette', 'West Village'), null);
    });
}

test('ambiguous branches, conflicting citations and incomplete result sets fail closed', () => {
    const row = fixture();
    assert.equal(selectVerifiedRestaurant([row, {...row, camis:'12345678'}], 'Buvette', 'West Village'), null);
    assert.equal(selectVerifiedRestaurant([row, {...row, camis:'12345678', latitude:''}], 'Buvette', 'West Village'), null);
    assert.equal(selectVerifiedRestaurant([row, {...row, building:'43'}], 'Buvette', 'West Village'), null);
    assert.equal(selectVerifiedRestaurant([row, {...row, latitude:String(Number(row.latitude)+0.0001)}], 'Buvette', 'West Village'), null);
    assert.equal(selectVerifiedRestaurant(Array(101).fill(row), 'Buvette', 'West Village'), null);
    assert.equal(selectVerifiedRestaurant([row], 'Buvette', ''), null);
    assert.equal(selectVerifiedRestaurant([row], 'Buvette', 'Invented Neighborhood'), null);
    assert.equal(selectVerifiedRestaurant({}, 'Buvette', 'West Village'), null);
});

test('unknown origins or venues have no invented fallback coordinates', async t => {
    let calls=0;
    t.mock.method(globalThis, 'fetch', async () => {calls++; return Response.json([]);});
    assert.equal(await lookupRestaurant('Buvette', 'Invented Neighborhood'), null);
    assert.equal(await lookupRestaurant('!!!', 'West Village'), null);
    assert.equal(calls, 0);
});

test('public lookup uses grouped bounded queries, caches public data, and sends no key or user position', async t => {
    let seen;
    t.mock.method(globalThis, 'fetch', async (url, options) => { seen = { url, options }; return Response.json([fixture()]); });
    const result = await lookupRestaurant('Buvette', 'West Village');
    assert.ok(result);
    const url = new URL(seen.url);
    assert.equal(url.origin, 'https://data.cityofnewyork.us');
    assert.equal(url.pathname, '/resource/43nn-pn8j.json');
    assert.match(url.searchParams.get('$where'), /BUVETTE.*Manhattan/);
    assert.equal(url.searchParams.get('$limit'), '101');
    assert.ok(url.searchParams.get('$group').includes('camis'));
    assert.equal(seen.options.headers, undefined);
    assert.equal(seen.options.body, undefined);
    assert.equal(seen.options.cache, 'force-cache');
    assert.equal(seen.options.next.revalidate, 86400);
    assert.ok(seen.options.signal);
});

test('lookup search tokens cannot inject SoQL expressions', async t => {
    let url;
    t.mock.method(globalThis, 'fetch', async value => {url = new URL(value); return Response.json([]);});
    await lookupRestaurant("Cafe'); DROP TABLE", 'West Village');
    assert.equal(url.searchParams.get('$where'), "upper(dba) like '%TABLE%' AND boro = 'Manhattan'");
});

test('public dataset errors and timeouts do not produce invented locations', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('', {status:429}));
    await assert.rejects(lookupRestaurant('Buvette','West Village'), /temporarily unavailable/);
    globalThis.fetch.mock.mockImplementation(async () => {throw new DOMException('timed out','TimeoutError');});
    await assert.rejects(lookupRestaurant('Buvette','West Village'), /timed out/);
});

const generationId = '00000000-0000-4000-8000-000000000001';
function setup({ signedIn = true, found = true, area = 'West Village', provider = async () => null } = {}) {
    let reads = 0;
    const client = {
        auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'test-user' } : null }, error: null }) },
        from(table) {
            reads++;
            assert.equal(table, 'generations');
            return { select(fields) {
                assert.equal(fields, 'title, content');
                return { eq(column, id) {
                    assert.equal(column, 'id'); assert.equal(id, generationId);
                    return { single: async () => ({ data: found ? { title: 'Test Cafe', content: JSON.stringify({ format: 'nyc-food-pick-v1', area, food: 'Test dish', recommendation: 'Test occasion' }) } : null, error: null }) };
                } };
            } };
        },
    };
    const route = load('app/api/restaurant-location/route.ts', client, { '@/utils/restaurant-location': { lookupRestaurant: provider } });
    return { route, reads: () => reads };
}
const request = body => new Request('http://localhost/api/restaurant-location', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

for (const [label, options, body, status] of [
    ['signed out', { signedIn: false }, { generationId }, 401],
    ['invalid pick ID', {}, { generationId: 'invalid' }, 400],
    ['precise coordinates rejected', {}, { generationId, latitude: 40, longitude: -74 }, 400],
    ['arbitrary restaurant rejected', {}, { name: 'Test Cafe', area: 'West Village' }, 400],
    ['missing saved pick', { found: false }, { generationId }, 404],
]) {
    test(`location endpoint: ${label}`, async () => {
        let lookups = 0;
        const { route, reads } = setup({ ...options, provider: async () => { lookups++; } });
        const response = await route.POST(request(body));
        assert.equal(response.status, status);
        assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
        assert.equal(lookups, 0);
        if (status === 401 || status === 400) assert.equal(reads(), 0);
    });
}

test('lookup succeeds without any Google API key', async t => {
    const old = process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_PLACES_API_KEY;
    t.after(() => { if (old !== undefined) process.env.GOOGLE_PLACES_API_KEY = old; });
    const { route, reads } = setup();
    const response = await route.POST(request({ generationId }));
    assert.equal(response.status, 200);
    assert.equal(reads(), 1);
    assert.deepEqual(await response.json(), { restaurant: null });
});

test('saved pick name and neighborhood drive lookup, with no user position', async () => {
    const { route } = setup({ provider: async (...args) => {
        assert.deepEqual(args.slice(0, 2), ['Test Cafe', 'West Village']);
        assert.ok(args[2] instanceof AbortSignal);
        return { latitude: 40.73, longitude: -74, recordId: 'synthetic' };
    } });
    const response = await route.POST(request({ generationId }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).restaurant.recordId, 'synthetic');
});

test('legacy missing area skips lookup and provider exceptions are sanitized', async () => {
    const provider = async () => { throw new Error('secret provider error'); };
    const noArea = await setup({ area: '', provider }).route.POST(request({ generationId }));
    assert.deepEqual(await noArea.json(), { restaurant: null });
    const failed = await setup({ provider }).route.POST(request({ generationId }));
    assert.equal(failed.status, 502);
    assert.doesNotMatch(JSON.stringify(await failed.json()), /secret/);
});

test('per-user burst limit stops extra provider calls', async () => {
    let calls = 0;
    const { route } = setup({ provider: async () => { calls++; return null; } });
    for (let i = 0; i < 30; i++) assert.equal((await route.POST(request({ generationId }))).status, 200);
    assert.equal((await route.POST(request({ generationId }))).status, 429);
    assert.equal(calls, 30);
});

test('distance origin stays in memory, has no device location API, and lookup body contains only a pick ID', () => {
    const provider = fs.readFileSync(new URL('../app/dashboard/location-provider.tsx', import.meta.url), 'utf8');
    const card = fs.readFileSync(new URL('../app/dashboard/restaurant-distance.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(provider, /localStorage|sessionStorage|supabase|fetch\(|console\.|navigator|geolocation|getCurrentPosition/);
    assert.match(card, /body: JSON\.stringify\(\{ generationId \}\)/);
    assert.doesNotMatch(card, /JSON\.stringify\([^)]*coordinates/);
});
