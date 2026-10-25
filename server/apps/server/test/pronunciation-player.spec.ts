import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { transpileModule, ModuleKind } from 'typescript';
const source = readFileSync(resolve(__dirname, '../../../../apps/web/src/hooks/useAudio.ts'), 'utf8');
const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } });
function setup(window: object = {}, rejection?: object) {
  const players: any[] = [];
  const cleanups: Function[] = [];
  class Audio {
    onplaying: Function; onended: Function; onerror: Function; onwaiting: Function;
    play = rejection ? jest.fn().mockRejectedValue(rejection) : jest.fn().mockResolvedValue(undefined);
    pause = jest.fn(); load = jest.fn(); removeAttribute = jest.fn();
    constructor(public src: string) { players.push(this); }
  }
  const module = { exports: {} as any };
  runInNewContext(outputText, { module, exports: module.exports, Audio, window, setTimeout, clearTimeout,
    require: () => ({ ref: value => ({ value }), computed: fn => ({ get value() { return fn(); } }), onBeforeUnmount: fn => cleanups.push(fn) }),
  });
  return { create: () => module.exports.useAudio(), players, cleanups };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
it('plays on browsers without Web Speech and follows actual audio events', () => {
  const f = setup(); const player = f.create(); player.playAudio('hello world');
  expect(f.players[0].src).toContain('word=hello%20world');
  expect(f.players[0].play).toHaveBeenCalledTimes(1);
  expect(player.isLoading.value).toBe(true); expect(player.isPlaying.value).toBe(false);
  f.players[0].onplaying(); expect(player.isPlaying.value).toBe(true);
  f.players[0].onended(); expect(player.isPlaying.value).toBe(false);
});
it('cancels old playback and ignores stale callbacks without stopping another owner', () => {
  const f = setup(); const a = f.create(); const b = f.create();
  a.playAudio('hello'); const stale = f.players[0].onplaying;
  b.playAudio('world'); stale();
  expect(f.players[0].pause).toHaveBeenCalled(); expect(a.isPlaying.value).toBe(false);
  f.players[1].onplaying(); f.cleanups[0](); expect(b.isPlaying.value).toBe(true);
  f.cleanups[1](); expect(f.players[1].pause).toHaveBeenCalled();
});
it('reports network failures and permits retry', () => {
  const f = setup(); const player = f.create(); player.playAudio('hello');
  f.players[0].onerror(); expect(player.error.value).toContain('失败');
  player.playAudio('hello'); expect(player.error.value).toBe('');
  jest.advanceTimersByTime(25_000); expect(player.error.value).toContain('超时');
});

it('reports autoplay denial without attempting an automatic fallback', async () => {
  const f = setup({}, { name: 'NotAllowedError' });
  const player = f.create(); player.playAudio('hello');
  await Promise.resolve();
  expect(player.error.value).toContain('点击喇叭');
});
