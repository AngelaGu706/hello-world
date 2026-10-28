import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load-source.mjs';
class ApiError extends Error { constructor(status) { super('Provider error'); this.status = status; } }
const output = (title = 'Buvette', area = 'West Village') => JSON.stringify({ title, area, food: 'Eggs', cuisine: 'French', content: 'A relaxed brunch to start your morning.' });
function fixture({ responses = [output()], history = [], failRpc, user = { id: 'user-1' } } = {}) {
  const calls = []; let invoked = 0; let sequence = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: history.map(title => ({ title })), error: null }) }) }) }) }),
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === failRpc) return { data: null, error: { code: 'TEST' } };
      return { data: name === 'food_start_request' ? 'request-1' : name === 'food_start_step' ? `step-${++sequence}` : name === 'food_complete_request' ? { id: 'pick-1', request_id: args.p_request_id, prompt: args.p_prompt, title: args.p_title, content: args.p_content } : null, error: null };
    },
  };
  class GoogleGenAI {
    models = { generateContent: async args => {
      calls.push({ name: 'model', args }); const next = responses[invoked++];
      if (next instanceof Error) throw next;
      return { text: next, usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 }, modelVersion: 'resolved-test-model' };
    } };
  }
  const { POST } = load('app/api/food-spots/route.ts', client, { '@google/genai': { GoogleGenAI, ApiError } });
  return { calls, invoke: async (body = { prompt: 'brunch please', cuisine: 'French', neighborhood: 'West Village' }) => {
    const previous = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = 'test-not-a-secret';
    try { return await POST(new Request('https://food.example/api/food-spots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })); }
    finally { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
  } };
}
test('a real handler records input, exact prompt, raw response and selected result in order', async () => {
  const f = fixture(); const res = await f.invoke(); assert.equal(res.status, 200);
  assert.deepEqual(f.calls.map(x => x.name), ['food_start_request','food_start_step','model','food_finish_step','food_complete_request']);
  assert.equal(f.calls[0].args.p_input, 'brunch please'); assert.equal(f.calls[0].args.p_neighborhood, 'West Village');
  assert.equal(f.calls[1].args.p_prompt, f.calls[2].args.contents);
  assert.equal(f.calls[3].args.p_output, output()); assert.equal(f.calls[3].args.p_valid, true);
  assert.equal(f.calls[3].args.p_usage.total_tokens, 30); assert.equal(f.calls[4].args.p_step_id, 'step-1');
  assert.equal((await res.json()).request_id, 'request-1');
  assert.ok(!JSON.stringify(f.calls).includes('test-not-a-secret'));
});
test('a repeated candidate records two distinct calls and selects the alternative', async () => {
  const f = fixture({ history: ['Buvette'], responses: [output(), output('Tartine')] });
  assert.equal((await f.invoke()).status, 200);
  const starts = f.calls.filter(x => x.name === 'food_start_step');
  assert.deepEqual(starts.map(x => x.args.p_kind), ['recommendation','variety_retry']);
  assert.match(starts[1].args.p_prompt, /previous candidate was "Buvette"/);
  assert.equal(f.calls.at(-1).args.p_step_id, 'step-2'); assert.equal(f.calls.at(-1).args.p_title, 'Tartine');
});
test('a failed alternative is recorded while the valid first result is preserved', async () => {
  const f = fixture({ history: ['Buvette'], responses: [output(), new ApiError(503)] });
  assert.equal((await f.invoke()).status, 200);
  const done = f.calls.filter(x => x.name === 'food_finish_step');
  assert.equal(done[1].args.p_error_code, 'model_http_503'); assert.equal(done[1].args.p_output, null);
  assert.equal(f.calls.at(-1).args.p_step_id, 'step-1');
});
test('provider failures and validation failures finish the trace without saving a pick', async () => {
  for (const [response, status] of [[new ApiError(429),429], [output('Buvette','Chinatown'),422]]) {
    const f = fixture({ responses: [response] }); assert.equal((await f.invoke()).status, status);
    assert.equal(f.calls.at(-1).name, 'food_fail_request');
    assert.equal(f.calls.some(x => x.name === 'food_complete_request'), false);
    assert.equal(f.calls.find(x => x.name === 'food_finish_step').args.p_valid, false);
  }
});
test('missing trace storage stops before a paid model call, and recording failure cannot silently save an untracked pick', async () => {
  for (const rpc of ['food_start_request','food_start_step','food_finish_step']) {
    const f = fixture({ failRpc: rpc }); assert.equal((await f.invoke()).status, 503);
    if (rpc !== 'food_finish_step') assert.equal(f.calls.some(x => x.name === 'model'), false);
    assert.equal(f.calls.some(x => x.name === 'food_complete_request'), false);
  }
});
test('failed final transaction returns an error and closes the request', async () => {
  const f = fixture({ failRpc: 'food_complete_request' }); assert.equal((await f.invoke()).status, 503);
  assert.equal(f.calls.at(-1).name, 'food_fail_request');
});
test('signed-out and invalid inputs never create traces or call the model', async () => {
  for (const [f, body, status] of [[fixture({user:null}),{prompt:'brunch please'},401],[fixture(),{prompt:'x'},400],[fixture(),{prompt:'brunch please',cuisine:'unsupported'},400]]) {
    assert.equal((await f.invoke(body)).status,status); assert.deepEqual(f.calls,[]);
  }
});
