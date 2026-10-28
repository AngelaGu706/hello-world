import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load-source.mjs';

const sample = (title, cuisine = 'French') => ({ title, cuisine, area: 'West Village', food: 'Brunch', content: 'Try the **eggs** for a relaxed brunch.' });
const request = (prompt = 'A cozy brunch spot in the West Village under $30', cuisine = 'French', neighborhood) => new Request('http://localhost/api/food-spots', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, cuisine, neighborhood }),
});

function fixture({ history = [{ title: 'Buvette' }], historyFailure, candidates = [sample('Cafe Cluny')] } = {}) {
    const calls = [], writes = [], queries = [];
    const client = {
        auth: { getUser: async () => ({ data: { user: { id: 'current-user' } }, error: null }) },
        async rpc(name, args) {
            if (name === 'food_start_request') return { data: 'request-1', error: null };
            if (name === 'food_start_step') return { data: 'step-' + (calls.length + 1), error: null };
            if (name === 'food_complete_request') {
                const saved = { user_id: 'current-user', prompt: args.p_prompt, title: args.p_title, content: args.p_content };
                writes.push(saved);
                return { data: { id: 'saved-generation', ...saved }, error: null };
            }
            return { data: null, error: null };
        },
        from(table) {
            assert.equal(table, 'generations');
            const query = {
                select(value) { queries.push(['select', value]); return query; },
                eq(key, value) { queries.push(['eq', key, value]); return query; },
                order(key, value) { queries.push(['order', key, value]); return query; },
                limit(value) { queries.push(['limit', value]); return query; },
                insert(value) { writes.push(value); return query; },
                single: async () => ({ data: { id: 'saved-generation', ...writes.at(-1) }, error: null }),
                then(resolve, reject) {
                    if (historyFailure === 'throw') return Promise.reject(new Error('Network unavailable')).then(resolve, reject);
                    return Promise.resolve({ data: historyFailure ? null : history, error: historyFailure ? { code: '42501' } : null }).then(resolve, reject);
                },
            };
            return query;
        },
    };
    class GoogleGenAI {
        models = { generateContent: async (input) => {
            const candidate = candidates[calls.length];
            calls.push(input);
            if (candidate instanceof Error) throw candidate;
            assert.ok(candidate, 'Unexpected extra model generation');
            return { text: JSON.stringify(candidate) };
        } };
    }
    const route = load('app/api/food-spots/route.ts', client, { '@google/genai': { GoogleGenAI, ApiError: class extends Error {} } });
    return { route, calls, writes, queries };
}

// No network or credentials: only the database and model are replaced.
process.env.GEMINI_API_KEY = 'test-only';

test('generation uses only the signed-in user recent venue names and preserves request constraints', async () => {
    const f = fixture();
    const response = await f.route.POST(request());
    assert.equal(response.status, 200);
    assert.equal(f.calls.length, 1);
    assert.match(f.calls[0].contents, /Recent restaurant names.*\["Buvette"\]/);
    assert.match(f.calls[0].contents, /West Village under \$30/);
    assert.match(f.calls[0].contents, /Selected cuisine: French/);
    assert.deepEqual(f.calls[0].config.responseJsonSchema.properties.cuisine.enum, ['French']);
    assert.ok(f.queries.some(q => q[0] === 'eq' && q[1] === 'user_id' && q[2] === 'current-user'));
    assert.ok(f.queries.some(q => q[0] === 'limit' && q[1] === 20));
    assert.equal(f.writes[0].user_id, 'current-user');
    assert.equal(f.writes[0].title, 'Cafe Cluny');
});

test('a repeated venue gets one alternative attempt and only the final recommendation is saved', async () => {
    const f = fixture({ candidates: [sample('Buvette'), sample('Cafe Cluny')] });
    const response = await f.route.POST(request());
    assert.equal(response.status, 200);
    assert.equal(f.calls.length, 2);
    assert.match(f.calls[1].contents, /previous candidate was "Buvette"/);
    assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0].title, 'Cafe Cluny');
});

test('an explicitly requested restaurant remains repeatable', async () => {
    const f = fixture({ candidates: [sample('Buvette')] });
    assert.equal((await f.route.POST(request('What should I order at Buvette?'))).status, 200);
    assert.equal(f.calls.length, 1);
    assert.equal(f.writes[0].title, 'Buvette');
});

for (const historyFailure of ['error', 'throw']) {
    test(`history ${historyFailure} does not block a valid recommendation`, async () => {
        const f = fixture({ historyFailure });
        assert.equal((await f.route.POST(request())).status, 200);
        assert.equal(f.calls.length, 1);
        assert.doesNotMatch(f.calls[0].contents, /Recent restaurant names/);
        assert.equal(f.writes.length, 1);
    });
}

for (const alternative of [new Error('Model temporarily unavailable'), sample('Different venue', 'Italian')]) {
    test(`a failed or wrong-cuisine alternative retains the first valid pick (${alternative.cuisine ?? 'network'})`, async () => {
        const f = fixture({ candidates: [sample('Buvette'), alternative] });
        assert.equal((await f.route.POST(request())).status, 200);
        assert.equal(f.calls.length, 2);
        assert.equal(f.writes.length, 1);
        assert.equal(f.writes[0].title, 'Buvette');
    });
}

test('a model that repeats twice has no unbounded retries or extra database rows', async () => {
    const f = fixture({ candidates: [sample('Buvette'), sample('Buvette')] });
    assert.equal((await f.route.POST(request())).status, 200);
    assert.equal(f.calls.length, 2);
    assert.equal(f.writes.length, 1);
});

test('first candidate with the wrong cuisine is rejected without saving', async () => {
    const f = fixture({ candidates: [sample('Different venue', 'Italian')] });
    assert.equal((await f.route.POST(request())).status, 502);
    assert.equal(f.writes.length, 0);
});

test('recent names normalize legacy titles and stay bounded without changing feed identities', () => {
    const { recentRestaurantNames, shouldTryDifferentRestaurant } = load('utils/recommendation-variety.ts');
    const names = recentRestaurantNames([{ title: 'Brunch at Buvette' }, { title: 'BUVETTE' }, { title: 'NYC Food Pick' },
        ...Array.from({ length: 10 }, (_, i) => ({ title: `Cafe ${i}` }))]);
    assert.equal(names.length, 6);
    assert.equal(names[0], 'Buvette');
    assert.equal(shouldTryDifferentRestaurant('Buvette', names, 'A cozy brunch'), true);
    assert.equal(shouldTryDifferentRestaurant('Buvette', names, 'Tell me about Buvette'), false);
    assert.equal(shouldTryDifferentRestaurant('Another Cafe', names, 'A cozy brunch'), false);
});

test('selected neighborhood is preserved with the saved request and matching recommendation', async () => {
    const f = fixture();
    const response = await f.route.POST(request('A brunch spot under $30', 'French', 'West Village'));
    assert.equal(response.status, 200);
    assert.equal(f.writes[0].prompt, 'A brunch spot under $30\nNeighborhood: West Village');
    assert.equal(JSON.parse(f.writes[0].content).area, 'West Village');
});

test('a response outside the selected neighborhood is rejected without saving', async () => {
    const f = fixture({ candidates: [{ ...sample('Another venue'), area: 'East Village' }] });
    const response = await f.route.POST(request('Brunch please', 'French', 'West Village'));
    assert.equal(response.status, 422);
    assert.match((await response.json()).error, /West Village/);
    assert.equal(f.writes.length, 0);
});

test('an invalid neighborhood is rejected before database or model calls', async () => {
    const f = fixture();
    assert.equal((await f.route.POST(request('Brunch please', 'French', 'Not an NYC neighborhood'))).status, 400);
    assert.equal(f.calls.length, 0);
    assert.equal(f.queries.length, 0);
    assert.equal(f.writes.length, 0);
});

test('a failed neighborhood match on a variety retry keeps the first valid local pick', async () => {
    const f = fixture({ candidates: [sample('Buvette'), { ...sample('Another venue'), area: 'Astoria' }] });
    assert.equal((await f.route.POST(request('Brunch please', 'French', 'West Village'))).status, 200);
    assert.equal(f.calls.length, 2);
    assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0].title, 'Buvette');
});

test('unselected location keeps free-text neighborhood requests and existing saved prompt format', async () => {
    const f = fixture({ candidates: [{ ...sample('Another venue'), area: 'Astoria' }] });
    assert.equal((await f.route.POST(request('Somewhere in Astoria', 'French'))).status, 200);
    assert.equal(f.calls[0].config.responseJsonSchema.properties.area.enum, undefined);
    assert.equal(f.writes[0].prompt, 'Somewhere in Astoria');
    assert.equal(JSON.parse(f.writes[0].content).area, 'Astoria');
});
