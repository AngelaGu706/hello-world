import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load } from './load-source.mjs';

const { haversineMiles, formatDistance, isCoordinates, requestCurrentLocation } = load('utils/distance.ts');
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

test('geolocation is rejected on insecure/unsupported browsers before touching permission API', async () => {
    let calls = 0;
    await assert.rejects(requestCurrentLocation(false, { getCurrentPosition() { calls++; } }), /HTTPS or localhost/);
    await assert.rejects(requestCurrentLocation(true), /doesn’t support/);
    assert.equal(calls, 0);
});

test('location helper returns only coordinates with bounded options', async () => {
    let options;
    const point = await requestCurrentLocation(true, { getCurrentPosition(success, error, received) {
        options = received;
        success({ coords: { latitude: 0, longitude: 0, accuracy: 123, altitude: 10 } });
    } });
    assert.deepEqual(point, { latitude: 0, longitude: 0 });
    assert.deepEqual(options, { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
});

for (const [code, message] of [[1, /site settings/], [2, /unavailable/], [3, /too long/]]) {
    test(`geolocation error ${code} is retryable without exposing browser errors`, async () => {
        await assert.rejects(requestCurrentLocation(true, { getCurrentPosition(success, fail) {
            fail({ code, message: 'private browser diagnostics' });
        } }), message);
    });
}

test('unanswered permission prompt has an overall deadline', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const pending = assert.rejects(requestCurrentLocation(true, { getCurrentPosition() {} }), /too long/);
    t.mock.timers.tick(15000);
    await pending;
});

// Synthetic provider-shaped fixture for validation only, never used as venue data.
const component = (longText, types, shortText = longText) => ({ longText, shortText, types: [types] });
const fixture = () => ({
    id: 'synthetic-test-place', displayName: { text: 'Test Café' },
    location: { latitude: 40.73, longitude: -74 }, businessStatus: 'OPERATIONAL',
    types: ['restaurant'], formattedAddress: 'Synthetic street address',
    addressComponents: [component('United States', 'country', 'US'), component('New York', 'administrative_area_level_1', 'NY'),
        component('New York', 'locality'), component('West Village', 'neighborhood'), component('1', 'street_number'), component('Test Street', 'route')],
});

test('unique exact restaurant and neighborhood normalize accents and return provider coordinates', () => {
    const place = fixture();
    const result = selectVerifiedRestaurant({ places: [place] }, 'TEST CAFE', 'West Village');
    assert.deepEqual({ latitude: result.latitude, longitude: result.longitude }, place.location);
    assert.equal(result.placeId, place.id);
    assert.equal(new URL(result.mapsUrl).searchParams.get('query_place_id'), place.id);
    assert.equal(selectVerifiedRestaurant({ places: [place, place] }, 'Test Café', 'West Village').placeId, place.id);
});

for (const [label, mutate] of [
    ['wrong name', p => { p.displayName.text = 'Test Cafe London'; }],
    ['wrong neighborhood', p => { p.addressComponents[3].longText = p.addressComponents[3].shortText = 'SoHo'; }],
    ['missing neighborhood', p => { p.addressComponents.splice(3, 1); }],
    ['outside NYC', p => { p.location.latitude = 41.5; }],
    ['missing coordinates', p => { delete p.location; }],
    ['non-finite coordinates', p => { p.location.longitude = Infinity; }],
    ['closed venue', p => { p.businessStatus = 'CLOSED_PERMANENTLY'; }],
    ['non-food place', p => { p.types = ['locality']; }],
    ['wrong country', p => { p.addressComponents[0] = component('Canada', 'country', 'CA'); }],
    ['wrong state', p => { p.addressComponents[1] = component('New Jersey', 'administrative_area_level_1', 'NJ'); }],
    ['neighboring city inside viewport', p => { p.addressComponents[2] = component('Jersey City', 'locality'); }],
    ['no street address', p => { p.addressComponents = p.addressComponents.filter(c => !c.types.includes('street_number')); }],
]) {
    test(`unverified ${label} never produces a distance coordinate`, () => {
        const place = fixture(); mutate(place);
        assert.equal(selectVerifiedRestaurant({ places: [place] }, 'Test Cafe', 'West Village'), null);
    });
}

test('ambiguous branches, incomplete pages, missing area and empty results fail closed', () => {
    const place = fixture();
    assert.equal(selectVerifiedRestaurant({ places: [place, { ...place, id: 'second-branch' }] }, 'Test Cafe', 'West Village'), null);
    assert.equal(selectVerifiedRestaurant({ places: [place], nextPageToken: 'more' }, 'Test Cafe', 'West Village'), null);
    assert.equal(selectVerifiedRestaurant({ places: [place] }, 'Test Cafe', ''), null);
    assert.equal(selectVerifiedRestaurant({}, 'Test Cafe', 'West Village'), null);
});

test('provider attribution links reject unsafe protocols', () => {
    const place = fixture();
    place.attributions = [{ provider: 'Test provider', providerUri: 'javascript:alert(1)' }];
    assert.deepEqual(selectVerifiedRestaurant({ places: [place] }, 'Test Cafe', 'West Village').attributions, [{ name: 'Test provider' }]);
});

test('lookup queries trusted endpoint with name + neighborhood, bounded NYC search, no user location', async t => {
    let seen;
    t.mock.method(globalThis, 'fetch', async (url, options) => { seen = { url, options }; return Response.json({ places: [fixture()] }); });
    const result = await lookupRestaurant('Test Cafe', 'West Village', 'test-server-key');
    assert.ok(result);
    assert.equal(seen.url, 'https://places.googleapis.com/v1/places:searchText');
    assert.equal(seen.options.cache, 'no-store');
    assert.equal(seen.options.headers['X-Goog-Api-Key'], 'test-server-key');
    assert.match(JSON.parse(seen.options.body).textQuery, /Test Cafe, West Village, New York City/);
    assert.equal(JSON.parse(seen.options.body).pageSize, 20);
    assert.ok(seen.options.signal);
});

test('provider errors and network timeouts do not produce invented locations', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 403 }));
    await assert.rejects(lookupRestaurant('Test Cafe', 'West Village', 'key'), /unavailable/);
    globalThis.fetch.mock.mockImplementation(async () => { throw new DOMException('timed out', 'TimeoutError'); });
    await assert.rejects(lookupRestaurant('Test Cafe', 'West Village', 'key'), /timed out/);
});

function setKey(t, value) {
    const old = process.env.GOOGLE_PLACES_API_KEY;
    process.env.GOOGLE_PLACES_API_KEY = value;
    t.after(() => { if (old === undefined) delete process.env.GOOGLE_PLACES_API_KEY; else process.env.GOOGLE_PLACES_API_KEY = old; });
}

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
    test(`location endpoint: ${label}`, async t => {
        setKey(t, 'test-server-key');
        let lookups = 0;
        const { route, reads } = setup({ ...options, provider: async () => { lookups++; } });
        const response = await route.POST(request(body));
        assert.equal(response.status, status);
        assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
        assert.equal(lookups, 0);
        if (status === 401 || status === 400) assert.equal(reads(), 0);
    });
}

test('missing provider key degrades without touching saved recommendations', async t => {
    setKey(t, '');
    const { route, reads } = setup();
    const response = await route.POST(request({ generationId }));
    assert.equal(response.status, 503);
    assert.equal(reads(), 0);
    assert.match((await response.json()).error, /aren’t set up/);
});

test('saved pick name and neighborhood drive lookup, with no user position', async t => {
    setKey(t, 'test-server-key');
    const { route } = setup({ provider: async (...args) => {
        assert.deepEqual(args.slice(0, 3), ['Test Cafe', 'West Village', 'test-server-key']);
        assert.ok(args[3] instanceof AbortSignal);
        return { latitude: 40.73, longitude: -74, placeId: 'synthetic' };
    } });
    const response = await route.POST(request({ generationId }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).restaurant.placeId, 'synthetic');
});

test('legacy missing area skips lookup and provider exceptions are sanitized', async t => {
    setKey(t, 'test-server-key');
    const provider = async () => { throw new Error('secret provider error'); };
    const noArea = await setup({ area: '', provider }).route.POST(request({ generationId }));
    assert.deepEqual(await noArea.json(), { restaurant: null });
    const failed = await setup({ provider }).route.POST(request({ generationId }));
    assert.equal(failed.status, 502);
    assert.doesNotMatch(JSON.stringify(await failed.json()), /secret/);
});

test('per-user burst limit stops extra provider calls', async t => {
    setKey(t, 'test-server-key');
    let calls = 0;
    const { route } = setup({ provider: async () => { calls++; return null; } });
    for (let i = 0; i < 30; i++) assert.equal((await route.POST(request({ generationId }))).status, 200);
    assert.equal((await route.POST(request({ generationId }))).status, 429);
    assert.equal(calls, 30);
});

test('location UI stores position only in memory and lookup body contains only a pick ID', () => {
    const provider = fs.readFileSync(new URL('../app/dashboard/location-provider.tsx', import.meta.url), 'utf8');
    const card = fs.readFileSync(new URL('../app/dashboard/restaurant-distance.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(provider, /localStorage|sessionStorage|supabase|fetch\(|console\./);
    assert.match(card, /body: JSON\.stringify\(\{ generationId \}\)/);
    assert.doesNotMatch(card, /JSON\.stringify\([^)]*coordinates/);
});
