import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';
import { transpileModule, ModuleKind } from 'typescript';

// Exercise the SDK source with browser events and deferred UV registration.
// Only browser fingerprinting and performance measurement are replaced.
describe('tracker login lifecycle', () => {
  function setup() {
    const events: Record<string, Function> = {};
    const beacon = jest.fn();
    const pending: { resolve: Function; signal: AbortSignal }[] = [];
    const fingerprint = jest.fn((_config, signal) => new Promise(resolve => pending.push({ resolve, signal })));
    const window = {
      location: { href: 'http://test/course', protocol: 'http:', host: 'test', pathname: '/course' },
      addEventListener: (name, fn) => { events[name] = fn; },
    };
    const document = { referrer: '', addEventListener: (name, fn) => { events[name] = fn; } };
    const history = { pushState() {}, replaceState() {} };
    const cache = new Map();
    function load(name: string) {
      if (name === '@/uv') return { getFingerprint: fingerprint };
      if (name === '@/performance') return { reportPerformance() {} };
      if (cache.has(name)) return cache.get(name);
      const path = name === 'entry' ? 'index.ts' : 'src/' + name.slice(2) + '/index.ts';
      const source = readFileSync(resolve(__dirname, '../../../../../apps/tracker', path), 'utf8');
      const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } });
      const module = { exports: {} };
      runInNewContext(outputText, { exports: module.exports, module, require: load, window, document, history,
        navigator: { sendBeacon: beacon }, Blob, AbortController, console });
      cache.set(name, module.exports);
      return module.exports;
    }
    const { Tracker } = load('entry');
    const tracker = new Tracker({ baseUrl: '/api', uv: { api: '/uv' }, pv: { api: '/pv' }, event: { api: '/event' }, error: { api: '/error' }, performance: { api: '/performance' } });
    return { tracker, pending, fingerprint, beacon, history, events };
  }
  it('sends nothing while logged out and stops synchronously on logout', async () => {
    const s = setup();
    s.history.pushState();
    expect(s.fingerprint).not.toHaveBeenCalled();
    expect(s.beacon).not.toHaveBeenCalled();
    const login = s.tracker.setUserId('a');
    s.pending[0].resolve('visitor-a'); await login;
    expect(s.beacon).toHaveBeenCalledTimes(1);
    s.history.pushState(); expect(s.beacon).toHaveBeenCalledTimes(2);
    await s.tracker.setUserId(undefined);
    s.history.replaceState(); s.events.popstate(); s.events.hashchange();
    s.events.click({ type: 'click', target: { nodeName: 'BUTTON', textContent: 'test', getBoundingClientRect: () => ({ left: 0, top: 0, width: 1, height: 1 }) } });
    s.events.error({ message: 'test', error: { stack: 'test' } });
    expect(s.beacon).toHaveBeenCalledTimes(2);
    const next = s.tracker.setUserId('b'); s.pending[1].resolve('visitor-b'); await next;
    s.history.pushState();
    expect(s.beacon).toHaveBeenCalledTimes(4); // No duplicate listeners after relogin.
    const body = JSON.parse(await s.beacon.mock.calls[3][1].text());
    expect(body.visitorId).toBe('visitor-b');
  });
  it('aborts pending registration and discards late results after logout', async () => {
    const s = setup();
    const login = s.tracker.setUserId('a');
    await s.tracker.setUserId(undefined);
    expect(s.pending[0].signal.aborted).toBe(true);
    s.pending[0].resolve('deleted-visitor'); await login;
    s.history.pushState();
    expect(s.beacon).not.toHaveBeenCalled();
  });
  it('reports null ErrorEvent payloads without masking the original browser error', async () => {
    const s = setup();
    const login = s.tracker.setUserId('a'); s.pending[0].resolve('visitor-a'); await login;
    expect(() => s.events.error({ error: null, message: 'ResizeObserver loop completed with undelivered notifications.' })).not.toThrow();
    const body = JSON.parse(await s.beacon.mock.calls[1][1].text());
    expect(body.message).toBe('ResizeObserver loop completed with undelivered notifications.');
    expect(body.stack).toBe('Stack unavailable');
    expect(body.url).toBe('http://test/course');
  });
  it('handles null, undefined, strings, circular and BigInt rejection reasons', async () => {
    const s = setup();
    const login = s.tracker.setUserId('a'); s.pending[0].resolve('visitor-a'); await login;
    const circular: any = {}; circular.self = circular;
    for (const reason of [null, undefined, 'failed', circular, BigInt(1)]) {
      expect(() => s.events.unhandledrejection({ reason })).not.toThrow();
      const body = JSON.parse(await s.beacon.mock.calls[s.beacon.mock.calls.length - 1][1].text());
      expect(typeof body.message).toBe('string');
      expect(body.line).toBe(0);
    }
  });
  it('preserves available error stacks and positions', async () => {
    const s = setup();
    const login = s.tracker.setUserId('a'); s.pending[0].resolve('visitor-a'); await login;
    s.events.unhandledrejection({ reason: { message: 'failure', stack: 'original stack', column: 2, line: 3 } });
    const body = JSON.parse(await s.beacon.mock.calls[1][1].text());
    expect(body).toMatchObject({ message: 'failure', stack: 'original stack', column: 2, line: 3 });
  });

});
