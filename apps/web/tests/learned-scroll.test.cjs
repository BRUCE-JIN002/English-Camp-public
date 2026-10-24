const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const vue = require('vue');
const { parse, compileScript } = require('vue/compiler-sfc');
function mount(load, mobile = false) {
  const mounted = [], cleanup = [], observers = [];
  const exports = {};
  const { descriptor } = parse(readFileSync(`${__dirname}/../src/views/Learned/index.vue`, 'utf8'));
  const source = ts.transpileModule(compileScript(descriptor, { id: 'learned-test' }).content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    window: { innerHeight: 800, matchMedia: () => ({ matches: mobile, addEventListener() {}, removeEventListener() {} }) },
    IntersectionObserver: class {
      constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this); }
      observe() {}
      disconnect() { this.disconnected = true; }
    },
    require(name) {
      if (name === 'vue') return { ...vue, onMounted: fn => mounted.push(fn), onBeforeUnmount: fn => cleanup.push(fn) };
      if (name === '@/apis/learn') return { getLearnedWords: load };
      if (name === '@/stores/user') return { useUserStore: () => ({ getUser: { id: 'test-user' } }) };
      if (name === '@/hooks/usePageRefresh') return { usePageRefresh() {} };
      if (name === '@/hooks/useLogin') return { useLogin: () => ({}) };
      if (name === '@/hooks/useAudio') return { useAudio: () => ({}) };
      if (name === 'vue-router') return { useRouter: () => ({}) };
      return {};
    },
  });
  const scope = vue.effectScope();
  const page = scope.run(() => exports.default.setup({}, { expose() {} }));
  const scroll = { getBoundingClientRect: () => ({ top: 200, bottom: 700 }) };
  page.wordScroll.value = scroll;
  page.loadTrigger.value = { getBoundingClientRect: () => ({ top: 400, bottom: 450 }) };
  mounted.forEach(fn => fn());
  return { page, observers, scroll, unmount() { cleanup.forEach(fn => fn()); scope.stop(); } };
}
const result = (page, count = 20, total = 25) => ({ success: true, data: { total, list: Array.from({ length: count }, (_, i) => ({ id: `${page}-${i}` })) } });

test('mobile observes the word scroller; desktop observes the whole viewport', () => {
  for (const mobile of [true, false]) {
    const app = mount(async () => result(1), mobile);
    assert.equal(app.observers[0].options.root, mobile ? app.page.wordScroll.value : null);
    app.unmount();
    assert.equal(app.observers[0].disconnected, true);
  }
});

test('fills a short viewport automatically and stops at the last page', async () => {
  const calls = [];
  const app = mount(async page => { calls.push(page); return result(page, page === 1 ? 20 : 5); });
  await app.page.loadMore();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [1, 2]);
  assert.equal(app.page.list.value.length, 25);
  assert.equal(app.page.hasMore.value, false);
  await app.page.loadMore();
  assert.deepEqual(calls, [1, 2]);
  app.unmount();
});

test('does not automatically loop on errors; explicit retry recovers', async () => {
  let calls = 0;
  const app = mount(async () => { if (++calls === 1) throw new Error('offline'); return result(1, 1, 1); });
  await app.page.loadMore();
  app.observers[0].callback([{ isIntersecting: true }]);
  assert.equal(calls, 1);
  assert.equal(app.page.error.value, true);
  await app.page.loadMore();
  assert.equal(app.page.list.value.length, 1);
  app.unmount();
});
