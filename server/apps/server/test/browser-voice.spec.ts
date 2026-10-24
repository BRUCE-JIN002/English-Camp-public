import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';
import { transpileModule, ModuleKind } from 'typescript';

const source = readFileSync(resolve(__dirname, '../../../../apps/web/src/hooks/useVocieToText.ts'), 'utf8');
const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } });
function setup(window: object) {
  const cleanup: Function[] = [];
  const module = { exports: {} as any };
  runInNewContext(outputText, { module, exports: module.exports, window, require: () => ({
    ref: (value) => ({ value }), onBeforeUnmount: (fn) => cleanup.push(fn),
  }) });
  return { create: () => module.exports.useVoiceToText({ lang: 'zh-CN' }), cleanup };
}

describe('optional speech input on mobile browsers', () => {
  it('keeps component setup working when speech recognition is absent', () => {
    const voice = setup({}).create();
    expect(voice.isSupported).toBe(false);
    expect(() => voice.start()).not.toThrow();
    expect(voice.error.value).toContain('不支持');
    expect(voice.isRecording.value).toBe(false);
    expect(() => voice.stop()).not.toThrow();
  });
  it('does not construct speech recognition until the microphone is clicked', () => {
    const ctor = jest.fn(() => { throw new Error('browser denied construction'); });
    const voice = setup({ webkitSpeechRecognition: ctor }).create();
    expect(ctor).not.toHaveBeenCalled();
    expect(() => voice.start()).not.toThrow();
    expect(voice.error.value).toContain('启动失败');
    expect(voice.isRecording.value).toBe(false);
  });
  it('recovers from synchronous start failure without breaking chat', () => {
    const voice = setup({ SpeechRecognition: function () { this.start = () => { throw new Error('denied'); }; } }).create();
    expect(() => voice.start()).not.toThrow();
    expect(voice.isRecording.value).toBe(false);
    expect(voice.error.value).toContain('启动失败');
  });
  it('supports prefixed browsers and handles results, denial and unmount', () => {
    const recognition: any = { start: jest.fn(), stop: jest.fn(), abort: jest.fn() };
    const fixture = setup({ webkitSpeechRecognition: function () { return recognition; } });
    const voice = fixture.create(); const result = jest.fn();
    voice.start(result);
    recognition.onresult({ results: [[{ transcript: 'Hello' }], [{ transcript: ' world' }]] });
    expect(result).toHaveBeenCalledWith('Hello world');
    recognition.onerror({ error: 'not-allowed' });
    expect(voice.isRecording.value).toBe(false);
    expect(voice.error.value).toContain('麦克风');
    fixture.cleanup[0]();
    expect(recognition.abort).toHaveBeenCalledTimes(1);
    expect(recognition.onresult).toBeNull();
  });
});
