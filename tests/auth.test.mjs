import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { load } from './load-source.mjs';

function sessionProxy({ claims = { sub: 'user-1' }, refreshed = [] } = {}) {
    return load('proxy.ts', null, {
        '@supabase/ssr': {
            createServerClient(_url, _key, { cookies }) {
                return { auth: { getClaims: async () => {
                    cookies.setAll(refreshed);
                    return { data: claims ? { claims } : null };
                } } };
            },
        },
    }).proxy;
}

test('session refresh reaches both the current server request and the browser', async () => {
    const request = new NextRequest('https://food.example/dashboard');
    const response = await sessionProxy({ refreshed: [
        { name: 'session-test', value: 'renewed', options: { path: '/', httpOnly: true, sameSite: 'lax' } },
    ] })(request);
    assert.equal(request.cookies.get('session-test').value, 'renewed');
    assert.equal(response.cookies.get('session-test').value, 'renewed');
    assert.equal(response.cookies.get('session-test').httpOnly, true);
    assert.match(response.headers.get('cache-control'), /private, no-store/);
    assert.equal(response.headers.get('location'), null);
});

for (const path of ['/dashboard', '/dashboard/picks', '/dashboard/bucket-list', '/profile']) {
    test(`signed-out ${path} returns to sign-in without losing cookie cleanup`, async () => {
        const request = new NextRequest(`https://food.example${path}?unused=value`);
        const response = await sessionProxy({ claims: null, refreshed: [
            { name: 'session-test', value: '', options: { path: '/', maxAge: 0 } },
        ] })(request);
        assert.equal(response.headers.get('location'), 'https://food.example/');
        assert.equal(response.cookies.get('session-test').maxAge, 0);
        assert.match(response.headers.get('cache-control'), /no-store/);
    });
}

test('proxy leaves API authentication to handlers so callers receive JSON rather than login HTML', async () => {
    const response = await sessionProxy({ claims: null })(new NextRequest('https://food.example/api/votes'));
    assert.equal(response.headers.get('location'), null);
});

function callback({ exchangeError = null, user = { id: 'user-1' }, profile = { first_name: 'Test', last_name: 'User' } } = {}) {
    const calls = [];
    const client = {
        auth: {
            exchangeCodeForSession: async code => { calls.push(code); return { error: exchangeError }; },
            getUser: async () => ({ data: { user }, error: null }),
        },
        from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: profile, error: null }) }) }) }),
    };
    return { get: load('app/auth/callback/route.ts', client).GET, calls };
}

test('successful OAuth callback verifies the user before opening Discover', async () => {
    const f = callback();
    const response = await f.get(new Request('https://food.example/auth/callback?code=test-only'));
    assert.deepEqual(f.calls, ['test-only']);
    assert.equal(response.headers.get('location'), 'https://food.example/dashboard');
    assert.match(response.headers.get('cache-control'), /private, no-store/);
});

test('first-time profile completion remains available after successful sign-in', async () => {
    const f = callback({ profile: null });
    const response = await f.get(new Request('https://food.example/auth/callback?code=test-only'));
    assert.equal(response.headers.get('location'), 'https://food.example/profile');
});

for (const options of [{ exchangeError: new Error('Expired code') }, { user: null }]) {
    test('failed or incomplete OAuth callback shows a retry message instead of silently looping', async () => {
        const f = callback(options);
        const response = await f.get(new Request('https://food.example/auth/callback?code=test-only'));
        assert.equal(response.headers.get('location'), 'https://food.example/?auth_error=signin_failed');
    });
}

test('cancelled sign-in does not attempt to exchange a missing code', async () => {
    const f = callback();
    const response = await f.get(new Request('https://food.example/auth/callback?error=access_denied'));
    assert.deepEqual(f.calls, []);
    assert.equal(response.headers.get('location'), 'https://food.example/?auth_error=signin_failed');
});
