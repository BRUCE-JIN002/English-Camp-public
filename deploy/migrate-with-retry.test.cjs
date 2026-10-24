const { test } = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('./migrate-with-retry.cjs');
const env = { DATABASE_URL: 'test-business', AI_DATABASE_URL: 'test-chat' };
const success = () => ({ status: 0 });

test('waits for both databases before migration', async () => {
  let calls = 0; let migrations = 0; const delays = [];
  const code = await run({ env, probe: async () => {
    if (++calls === 1) throw Object.assign(new Error(), { code: 'ECONNREFUSED' });
  }, wait: async ms => delays.push(ms), migrate: () => { migrations++; return success(); } });
  assert.equal(code, 0); assert.equal(calls, 3); assert.equal(migrations, 1); assert.deepEqual(delays, [5000]);
});
test('authentication failures stop immediately', async () => {
  assert.equal(await run({ env, probe: async () => { throw Object.assign(new Error(), { code: '28P01' }); },
    wait: () => assert.fail('must not retry'), migrate: () => assert.fail('must not migrate') }), 1);
});
test('connection checks stop after six attempts', async () => {
  let calls = 0;
  assert.equal(await run({ env, probe: async () => { calls++; throw new Error('Connection timeout'); },
    wait: async () => {}, migrate: () => assert.fail('must not migrate') }), 1);
  assert.equal(calls, 6);
});
test('P1001/P1002 recheck connectivity then retry migration, at most three times', async () => {
  let calls = 0; let probes = 0;
  assert.equal(await run({ env, probe: async () => { probes++; }, wait: async () => {},
    migrate: () => ({ status: 1, stderr: ++calls === 1 ? 'Error: P1001' : 'Error: P1002' }) }), 1);
  assert.equal(calls, 3); assert.equal(probes, 6);
});
test('a transient migration failure can recover', async () => {
  let calls = 0;
  assert.equal(await run({ env, probe: async () => {}, wait: async () => {},
    migrate: () => ++calls === 1 ? { status: 1, stderr: 'Error: P1001' } : success() }), 0);
  assert.equal(calls, 2);
});
test('schema errors and killed migration processes are not retried', async () => {
  for (const result of [{ status: 1, stderr: 'Error: P3018' }, { status: 1, stderr: 'P1001 P3009' }, { status: null, signal: 'SIGTERM' }, { error: new Error('timeout') }]) {
    let calls = 0;
    assert.equal(await run({ env, probe: async () => {}, wait: () => assert.fail('must not retry'),
      migrate: () => { calls++; return result; } }), 1);
    assert.equal(calls, 1);
  }
});
