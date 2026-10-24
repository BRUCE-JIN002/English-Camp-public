const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const vue = require('vue');
const { parse, compileScript } = require('vue/compiler-sfc');

test('owned course highlight waits for loading and card mounting, and clears on leaving', async () => {
  const cleanup = [], timers = new Map(), frames = new Map();
  const paint = (now) => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(fn => fn(now));
  };
  let resolveList, calls = 0, scrolled = 0, cards = [];
  const exports = {};
  const { descriptor } = parse(readFileSync(`${__dirname}/../src/views/Course/index.vue`, 'utf8'));
  const source = ts.transpileModule(compileScript(descriptor, { id: 'course-test' }).content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { success: true, data: [{ id: 'owned-course' }] };
  vm.runInNewContext(source, {
    exports,
    window: { innerHeight: 800 },
    getComputedStyle: () => ({ overflowY: "auto" }),
    setTimeout(fn) { timers.set(fn, fn); return fn; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(fn) { frames.set(fn, fn); return fn; },
    cancelAnimationFrame(id) { frames.delete(id); },
    require(name) {
      if (name === 'vue') return { ...vue, onBeforeUnmount: fn => cleanup.push(fn) };
      if (name === '@/apis/course') return {
        getMyCourse: () => ++calls === 1 ? Promise.resolve(result) : new Promise(resolve => { resolveList = resolve; }),
        getCourseList: async () => result,
      };
      if (name === '@/stores/user') return { useUserStore: () => ({ user: { id: 'user' } }) };
      if (name === '@/hooks/useLogin') return { useLogin: () => ({ login: async () => {} }) };
      if (name === '@/hooks/usePageRefresh') return { usePageRefresh() {} };
      if (name === 'vue-router') return { useRouter: () => ({}), useRoute: () => ({ query: {} }) };
      return {};
    },
  });
  const scope = vue.effectScope();
  const page = scope.run(() => exports.default.setup({}, { expose() {} }));
  try {
    page.courseScroll.value = {
      scrollHeight: 3000, clientHeight: 600,
      getBoundingClientRect: () => ({ top: 100, bottom: 700 }),
      querySelectorAll: selector => {
        assert.equal(selector, '[data-course-tab="my"] [data-course-id]');
        return cards;
      },
    };
    await page.openPay({ id: 'owned-course' });
    await vue.nextTick();
    assert.equal(page.currentTab.value, 'my');
    assert.equal(page.loading.value, true);
    assert.equal(page.highlightId.value, null);
    assert.equal(timers.size, 0);
    resolveList(result);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(page.highlightId.value, null);
    let top = 2000;
    cards = [{ getBoundingClientRect: () => ({ top, bottom: top + 200 }), isConnected: true, dataset: { courseId: 'owned-course' }, scrollIntoView(options) {
      assert.equal(options.behavior, 'smooth');
      assert.equal(options.block, 'center');
      scrolled++;
    } }];
    page.onTabLeaving();
    page.revealPurchasedCourse();
    assert.equal(scrolled, 0);
    page.onTabEntered();
    assert.equal(scrolled, 1);
    assert.equal(page.highlightId.value, null);
    assert.equal(timers.size, 0);
    paint(0);
    paint(250);
    assert.equal(page.highlightId.value, null); // Still outside the scroll viewport.
    top = 400;
    paint(300);
    top = 300;
    paint(400);
    assert.equal(page.highlightId.value, null); // Visible but still moving.
    paint(500);
    assert.equal(page.highlightId.value, null);
    paint(550);
    assert.equal(page.highlightId.value, 'owned-course');
    assert.equal(timers.size, 1);
    page.currentTab.value = 'list';
    await vue.nextTick();
    assert.equal(page.highlightId.value, null);
    assert.equal(timers.size, 0);
  } finally {
    cleanup.forEach(fn => fn());
    scope.stop();
  }
});
