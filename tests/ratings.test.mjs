import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load-source.mjs';
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];

function database(options = {}) {
    const generations = ids.map((id, index) => ({ id, title: 'Buvette', prompt: 'Brunch', content: 'Same recommendation', created_at: `2026-10-${14 - index}T12:00:00Z` }));
    const votes = [...(options.votes ?? [])];
    const calls = [];
    const client = {
        auth: { getUser: async () => ({ data: { user: options.signedOut ? null : { id: 'current-user' } }, error: null }) },
        rpc: async (name, args) => {
            calls.push({ name, args });
            assert.equal(name, 'get_generation_ratings');
            if (options.throwRpc) throw new Error('Network unavailable');
            if (options.rpcError) return { data: null, error: { code: options.rpcError } };
            return { error: null, data: options.noRows ? [] : args.generation_ids.filter(id => generations.some(g => g.id === id)).map(id => ({
                generation_id: id,
                up_count: String(votes.filter(v => v.generation_id === id && v.vote === 'up').length),
                down_count: String(votes.filter(v => v.generation_id === id && v.vote === 'down').length),
                my_vote: votes.find(v => v.generation_id === id && v.user_id === 'current-user')?.vote ?? null,
            })) };
        },
        from(table) {
            const filters = [];
            let insertion;
            let removal = false;
            const query = {
                select() { return query; },
                order() { return query; },
                limit() { return query; },
                eq(field, value) { filters.push(row => row[field] === value); return query; },
                in(field, values) { filters.push(row => values.includes(row[field])); return query; },
                upsert(value, { onConflict }) {
                    assert.equal(onConflict, 'user_id,generation_id');
                    insertion = value;
                    return query;
                },
                delete() { removal = true; return query; },
                async single() {
                    if (options.saveError) return { data: null, error: { code: options.saveError } };
                    if (!generations.some(g => g.id === insertion.generation_id)) return { data: null, error: { code: '23503' } };
                    const existing = votes.find(v => v.generation_id === insertion.generation_id && v.user_id === insertion.user_id);
                    if (existing) existing.vote = insertion.vote;
                    else votes.push(insertion);
                    return { data: { id: 'saved-vote', vote: insertion.vote }, error: null };
                },
                then(resolve, reject) {
                    if (table === 'votes') assert.ok(filters.length >= 2, 'Reads and removals must filter by user and generation IDs');
                    if (removal) {
                        if (options.saveError) return Promise.resolve({ data: null, error: { code: options.saveError } }).then(resolve, reject);
                        for (let i = votes.length - 1; i >= 0; i--) {
                            if (filters.every(matches => matches(votes[i]))) votes.splice(i, 1);
                        }
                        return Promise.resolve({ data: null, error: null }).then(resolve, reject);
                    }
                    const rows = table === 'generations' ? generations : votes;
                    return Promise.resolve({ data: rows.filter(row => filters.every(matches => matches(row))), error: null }).then(resolve, reject);
                },
            };
            return query;
        },
    };
    return { client, votes, calls };
}
const get = id => new Request(`http://localhost/api/votes?generationId=${id}`);
const post = (generationId, vote) => new Request('http://localhost/api/votes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generationId, vote }),
});

test('fresh generation loads confirmed zero counts without an unavailable state', async () => {
    const db = database();
    const route = load('app/api/votes/route.ts', db.client);
    const response = await route.GET(get(ids[0]));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual((await response.json()).rating, { myVote: null, upCount: 0, downCount: 0 });
});

const remove = generationId => new Request('http://localhost/api/votes', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generationId }),
});

test('vote changes direction and survives refresh without adding a second vote', async () => {
    const db = database();
    const route = load('app/api/votes/route.ts', db.client);
    const saved = await route.POST(post(ids[0], 'up'));
    assert.equal(saved.status, 200);
    assert.deepEqual((await saved.json()).rating, { myVote: 'up', upCount: 1, downCount: 0 });
    const changed = await route.POST(post(ids[0], 'down'));
    assert.equal(changed.status, 200);
    assert.deepEqual((await changed.json()).rating, { myVote: 'down', upCount: 0, downCount: 1 });
    const refreshed = await load('app/api/votes/route.ts', db.client).GET(get(ids[0]));
    assert.deepEqual((await refreshed.json()).rating, { myVote: 'down', upCount: 0, downCount: 1 });
    assert.equal(db.votes.length, 1);
});

test('resubmitting an identical vote is idempotent, and parallel sets keep one row', async () => {
    const db = database();
    const route = load('app/api/votes/route.ts', db.client);
    await Promise.all(Array.from({ length: 5 }, () => route.POST(post(ids[0], 'up'))));
    assert.equal(db.votes.length, 1);
    const read = await route.GET(get(ids[0]));
    assert.deepEqual((await read.json()).rating, { myVote: 'up', upCount: 1, downCount: 0 });
});

test('undo is idempotent, survives refresh, and allows voting again', async () => {
    const db = database();
    const route = load('app/api/votes/route.ts', db.client);
    await route.POST(post(ids[0], 'up'));
    for (let i = 0; i < 2; i++) {
        const cleared = await route.DELETE(remove(ids[0]));
        assert.equal(cleared.status, 200);
        assert.deepEqual((await cleared.json()).rating, { myVote: null, upCount: 0, downCount: 0 });
    }
    const refreshed = await load('app/api/votes/route.ts', db.client).GET(get(ids[0]));
    assert.equal((await refreshed.json()).rating.myVote, null);
    assert.equal(db.votes.length, 0);
    await route.POST(post(ids[0], 'down'));
    assert.equal(db.votes.length, 1);
    assert.equal(db.votes[0].vote, 'down');
});

test('change and undo affect only the caller and selected pick, ignoring supplied user IDs', async () => {
    const db = database({ votes: [
        { generation_id: ids[0], user_id: 'other-user', vote: 'up' },
        { generation_id: ids[0], user_id: 'current-user', vote: 'up' },
        { generation_id: ids[1], user_id: 'current-user', vote: 'up' },
    ] });
    const route = load('app/api/votes/route.ts', db.client);
    const request = method => new Request('http://localhost/api/votes', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationId: ids[0], vote: 'down', user_id: 'other-user' }),
    });
    const changed = await route.POST(request('POST'));
    assert.deepEqual((await changed.json()).rating, { myVote: 'down', upCount: 1, downCount: 1 });
    const cleared = await route.DELETE(request('DELETE'));
    assert.deepEqual((await cleared.json()).rating, { myVote: null, upCount: 1, downCount: 0 });
    assert.equal(db.votes.length, 2);
    assert.equal(db.votes.find(v => v.user_id === 'other-user').vote, 'up');
    assert.equal(db.votes.find(v => v.generation_id === ids[1]).vote, 'up');
});

test('community totals include other users while personal selection stays private', async () => {
    const db = database({ votes: [
        { generation_id: ids[0], user_id: 'other-user', vote: 'up' },
        { generation_id: ids[0], user_id: 'current-user', vote: 'down' },
        { generation_id: ids[1], user_id: 'other-user', vote: 'up' },
    ] });
    const route = load('app/api/food-spots/route.ts', db.client);
    const response = await route.GET();
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.generations.length, 2);
    assert.deepEqual(body.generations.map(g => [g.id, g.upCount, g.downCount, g.myVote]), [
        [ids[0], 1, 1, 'down'], [ids[1], 1, 0, null],
    ]);
    assert.deepEqual(db.calls[0].args.generation_ids, ids);
});

for (const rpcError of ['PGRST202', '42883', '42501']) {
    test(`RPC error ${rpcError} preserves picks and own vote without fabricating totals`, async () => {
        const db = database({ rpcError, votes: [{ generation_id: ids[0], user_id: 'current-user', vote: 'up' }] });
        const feed = await load('app/api/food-spots/route.ts', db.client).GET();
        const body = await feed.json();
        assert.equal(feed.status, 200);
        assert.equal(body.generations.length, 2);
        assert.equal(body.generations[0].myVote, 'up');
        assert.equal(body.generations[0].upCount, null);
        assert.ok(body.ratingsError);
        const read = await load('app/api/votes/route.ts', db.client).GET(get(ids[0]));
        assert.equal(read.status, 503);
    });
}

for (const failure of [{ rpcError: 'PGRST202' }, { throwRpc: true }]) {
    test(`saved write stays successful when aggregate refresh fails (${JSON.stringify(failure)})`, async () => {
        const db = database(failure);
        const response = await load('app/api/votes/route.ts', db.client).POST(post(ids[0], 'down'));
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.deepEqual(body.rating, { myVote: 'down', upCount: null, downCount: null });
        assert.ok(body.ratingsError);
        assert.equal(db.votes.length, 1);
    });
}

test('missing aggregate rows are an error rather than fake zero ratings', async () => {
    const db = database({ noRows: true });
    const response = await load('app/api/votes/route.ts', db.client).GET(get(ids[0]));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).rating.upCount, null);
});

test('aggregate network failure preserves a changed vote and confirmed removal without fake totals', async () => {
    const db = database({ throwRpc: true, votes: [{ generation_id: ids[0], user_id: 'current-user', vote: 'up' }] });
    const route = load('app/api/votes/route.ts', db.client);
    const refreshed = await route.GET(get(ids[0]));
    assert.equal(refreshed.status, 503);
    assert.deepEqual((await refreshed.json()).rating, { myVote: 'up', upCount: null, downCount: null });
    const duplicate = await route.POST(post(ids[0], 'down'));
    assert.equal(duplicate.status, 200);
    assert.deepEqual((await duplicate.json()).rating, { myVote: 'down', upCount: null, downCount: null });
    assert.equal(db.votes.length, 1);
    const cleared = await route.DELETE(remove(ids[0]));
    assert.equal(cleared.status, 200);
    assert.deepEqual((await cleared.json()).rating, { myVote: null, upCount: null, downCount: null });
    assert.equal(db.votes.length, 0);
});

test('signed-out reads and writes cannot access ratings', async () => {
    const db = database({ signedOut: true });
    const route = load('app/api/votes/route.ts', db.client);
    assert.equal((await route.GET(get(ids[0]))).status, 401);
    assert.equal((await route.POST(post(ids[0], 'up'))).status, 401);
    assert.equal((await route.DELETE(remove(ids[0]))).status, 401);
    assert.equal(db.calls.length, 0);
    assert.equal(db.votes.length, 0);
});

test('invalid IDs and vote values are rejected before touching the database', async () => {
    const db = database();
    const route = load('app/api/votes/route.ts', db.client);
    assert.equal((await route.GET(get('Buvette'))).status, 400);
    assert.equal((await route.POST(post(ids[0], 'invalid'))).status, 400);
    assert.equal((await route.POST(post('Buvette', 'up'))).status, 400);
    assert.equal((await route.DELETE(remove('Buvette'))).status, 400);
    assert.equal(db.votes.length, 0);
});

test('failed insert is reported as unsaved, with no extra votes', async () => {
    const db = database({ saveError: '42501' });
    const response = await load('app/api/votes/route.ts', db.client).POST(post(ids[0], 'up'));
    assert.equal(response.status, 500);
    assert.match((await response.json()).error, /Couldn't save rating/);
    assert.equal(db.votes.length, 0);
});

test('same restaurant and identical content remain distinct generations in the feed', () => {
    const { uniqueLatestPicks } = load('utils/community-picks.ts');
    const same = { title: 'Brunch at Buvette', prompt: 'brunch', content: 'Same content', created_at: '2026-10-14T12:00:00Z' };
    const picks = [{ ...same, id: ids[0] }, { ...same, id: ids[1] }, { ...same, id: ids[0] }];
    assert.deepEqual(uniqueLatestPicks(picks).map(g => g.id), ids);
});

for (const method of ['POST', 'DELETE']) {
    test(`failed ${method} leaves the existing vote unchanged`, async () => {
        const db = database({ saveError: '42501', votes: [{ generation_id: ids[0], user_id: 'current-user', vote: 'up' }] });
        const route = load('app/api/votes/route.ts', db.client);
        const response = await route[method](method === 'POST' ? post(ids[0], 'down') : remove(ids[0]));
        assert.equal(response.status, 500);
        assert.equal(db.votes.length, 1);
        assert.equal(db.votes[0].vote, 'up');
    });
}

test('deleted recommendation cannot receive a vote', async () => {
    const db = database();
    const response = await load('app/api/votes/route.ts', db.client).POST(post('33333333-3333-4333-8333-333333333333', 'up'));
    assert.equal(response.status, 404);
    assert.equal(db.votes.length, 0);
});
