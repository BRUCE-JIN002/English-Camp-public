const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const vue = require('vue');
const { parse, compileScript } = require('vue/compiler-sfc');

function newSelection() {
  const exports = {};
  const source = ts.transpileModule(readFileSync(`${__dirname}/../src/stores/chatSelection.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports });
  return exports;
}

function mount(history = async () => ({ success: true, data: [] }), selection = newSelection(), userId = 'test-user') {
  const requests = [], cleanup = [];
  const exports = {};
  const { descriptor } = parse(readFileSync(`${__dirname}/../src/views/Chat/index.vue`, 'utf8'));
  const script = compileScript(descriptor, { id: 'chat-test' }).content;
  const source = ts.transpileModule(script, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, {
    exports, AbortController,
    window: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) },
    require(name) {
      if (name === 'vue') return { ...vue, onMounted() {}, onBeforeUnmount(fn) { cleanup.push(fn); } };
      if (name === '@/stores/user') return { useUserStore: () => ({ user: { id: userId } }) };
      if (name === '@/stores/chatSelection') return selection;
      if (name === '@/apis/chat') return { getChatHistory: history, getChatMode: async () => ({ code: 200, data: ['a', 'b'].map(role => ({ id: role, role, icon: 'AI' })) }) };
      if (name === 'element-plus') return { ElMessage: { error() {} } };
      if (name === '@/apis/sse') return { CHAT_URL: '/ai/v1/chat', sse: (url, method, body, delta, error, controller, done) => requests.push({ body, delta, error, controller, done }) };
      return {};
    },
  });
  const chat = exports.default.setup({}, { expose() {} });
  chat.chatModeList.value = ['a', 'b'].map(role => ({ id: role, role, icon: 'AI' }));
  return { chat, requests, unmount: () => cleanup.forEach(fn => fn()) };
}

test('switching away and back preserves incremental output and the active connection', async () => {
  const { chat, requests, unmount } = mount();
  await chat.getRole('a');
  chat.sendMessage('hello', false, false);
  requests[0].delta({ type: 'chat', content: 'first' });
  await chat.getRole('b');
  assert.equal(requests[0].controller.signal.aborted, false);
  assert.equal(chat.streaming.value, false);
  requests[0].delta({ type: 'chat', content: ' second' });
  assert.equal(chat.chatList.value.length, 0);
  await chat.getRole('a');
  assert.equal(chat.chatList.value[1].content, 'first second');
  assert.equal(chat.streaming.value, true);
  requests[0].delta({ type: 'chat', content: ' third' });
  assert.equal(chat.chatList.value[1].content, 'first second third');
  requests[0].done();
  assert.equal(chat.streaming.value, false);
  unmount();
});

test('concurrent conversations keep reasoning, content and completion separate', async () => {
  const { chat, requests, unmount } = mount();
  await chat.getRole('a'); chat.sendMessage('A', true, false);
  await chat.getRole('b'); chat.sendMessage('B', false, false);
  requests[0].delta({ type: 'reasoning', content: 'thinking A' });
  requests[0].delta({ type: 'chat', content: 'answer A' });
  requests[0].done();
  assert.equal(chat.streaming.value, true);
  requests[1].delta({ type: 'chat', content: 'answer B' });
  assert.equal(chat.chatList.value[1].content, 'answer B');
  await chat.getRole('a');
  assert.equal(chat.chatList.value[1].reasoning, 'thinking A');
  assert.equal(chat.chatList.value[1].content, 'answer A');
  assert.equal(chat.streaming.value, false);
  unmount();
  assert.equal(requests[1].controller.signal.aborted, true);
});

test('returning while history is loading does not issue duplicates or overwrite another conversation', async () => {
  const pending = {};
  let calls = 0;
  const { chat, unmount } = mount((user, role) => { calls++; return new Promise(resolve => { pending[role] = resolve; }); });
  const a = chat.getRole('a');
  const b = chat.getRole('b');
  await chat.getRole('a');
  assert.equal(calls, 2);
  pending.b({ success: true, data: [{ role: 'ai', content: 'B', type: 'chat' }] }); await b;
  assert.equal(chat.loadingHistory.value, true);
  assert.equal(chat.chatList.value.length, 0);
  pending.a({ success: true, data: [{ role: 'ai', content: 'A', type: 'chat' }] }); await a;
  assert.equal(chat.chatList.value[0].content, 'A');
  assert.equal(chat.loadingHistory.value, false);
  unmount();
});


test('route remount restores the last selection, but browser reload and other accounts start fresh', async () => {
  const selection = newSelection();
  const first = mount(undefined, selection);
  await first.chat.initModes();
  await first.chat.getRole('b');
  first.unmount();
  const returned = mount(undefined, selection);
  await returned.chat.initModes();
  assert.equal(returned.chat.role.value, 'b');
  returned.unmount();
  const other = mount(undefined, selection, 'other-user');
  await other.chat.initModes();
  assert.equal(other.chat.role.value, 'a');
  other.unmount();
  const reloaded = mount(undefined, newSelection());
  await reloaded.chat.initModes();
  assert.equal(reloaded.chat.role.value, 'a');
  reloaded.unmount();
});

test('a remembered agent that is no longer available falls back to the first agent', async () => {
  const selection = newSelection();
  selection.rememberChatRole('test-user', 'deleted-agent');
  const page = mount(undefined, selection);
  await page.chat.initModes();
  assert.equal(page.chat.role.value, 'a');
  assert.equal(selection.getSelectedChatRole('test-user'), 'a');
  page.unmount();
});
