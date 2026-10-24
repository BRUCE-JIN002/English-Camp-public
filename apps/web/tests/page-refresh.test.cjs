const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const vue = require('vue');

// Exercise the real hook with Vue's reactive watcher and controlled browser events.
function mount(refresh) {
  const route = vue.reactive({ fullPath: '/home' });
  const store = vue.reactive({ user: { id: 'account-a' } });
  const document = new EventTarget();
  document.visibilityState = 'visible';
  const window = new EventTarget();
  const mounted = [], unmounted = [], timers = new Map();
  let id = 0;
  const scope = vue.effectScope();
  const exports = {};
  const source = ts.transpileModule(readFileSync(`${__dirname}/../src/hooks/usePageRefresh.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports, document, window,
    setTimeout: callback => { timers.set(++id, callback); return id; },
    clearTimeout: key => timers.delete(key),
    require: name => {
      if (name === 'vue') return { ...vue, onMounted: fn => mounted.push(fn), onBeforeUnmount: fn => unmounted.push(fn) };
      if (name === 'vue-router') return { useRoute: () => route };
      if (name === '@/stores/user') return { useUserStore: () => store };
      throw new Error(name);
    },
  });
  scope.run(() => exports.usePageRefresh(refresh));
  mounted.forEach(fn => fn());
  return {
    route, store, document, window,
    flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    unmount() { unmounted.forEach(fn => fn()); scope.stop(); },
  };
}

test('refreshes on entry and route/query changes, coalesces foreground events', () => {
  let calls = 0;
  const app = mount(() => { calls++; });
  app.flush(); assert.equal(calls, 1);
  app.route.fullPath = '/setting'; app.flush(); assert.equal(calls, 2);
  app.route.fullPath = '/courses?tab=my'; app.flush(); assert.equal(calls, 3);
  app.document.dispatchEvent(new Event('visibilitychange'));
  app.window.dispatchEvent(new Event('focus'));
  app.window.dispatchEvent(new Event('pageshow'));
  app.flush(); assert.equal(calls, 4);
  app.document.visibilityState = 'hidden';
  app.document.dispatchEvent(new Event('visibilitychange'));
  app.flush(); assert.equal(calls, 4);
  app.unmount();
});

test('late responses cannot overwrite a new route, another account, or logout', async () => {
  let finish;
  let writes = 0;
  const app = mount(async isCurrent => {
    await new Promise(resolve => { finish = resolve; });
    if (isCurrent()) writes++;
  });
  app.flush(); app.route.fullPath = '/setting'; finish(); await Promise.resolve();
  assert.equal(writes, 0);
  app.flush(); app.store.user = { id: 'account-b' }; finish(); await Promise.resolve();
  assert.equal(writes, 0);
  app.flush(); app.store.user = null; finish(); await Promise.resolve();
  assert.equal(writes, 0);
  app.unmount();
});

test('unmount cancels pending refreshes and invalidates in-flight responses', () => {
  let calls = 0, current;
  const app = mount(isCurrent => { calls++; current = isCurrent; });
  app.flush(); assert.equal(current(), true);
  app.route.fullPath = '/learned';
  app.unmount(); app.flush();
  app.window.dispatchEvent(new Event('focus')); app.flush();
  assert.equal(calls, 1);
  assert.equal(current(), false);
});
