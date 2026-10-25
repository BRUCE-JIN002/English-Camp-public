import { computed, onBeforeUnmount, ref } from 'vue';

export interface Options {
  rate?: number;
  volume?: number;
  pitch?: number;
  lang?: string;
}
let utterance: SpeechSynthesisUtterance | null = null;
const activeOwner = ref<symbol | null>(null);
const speaking = ref(false);

export const useAudio = (options: Options = {}) => {
  const owner = Symbol('pronunciation');
  const error = ref('');
  const stopAudio = () => {
    if (activeOwner.value !== owner) return;
    utterance = null;
    activeOwner.value = null;
    speaking.value = false;
    window.speechSynthesis?.cancel();
  };
  const playAudio = (word: string) => {
    error.value = '';
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      error.value = '当前浏览器暂不支持发音播放';
      return;
    }
    if (!word.trim()) return;
    // Invalidate the old callbacks before cancelling; rapid taps must not queue speech.
    utterance = null;
    activeOwner.value = null;
    speaking.value = false;
    window.speechSynthesis.cancel();
    const next = new SpeechSynthesisUtterance(word);
    Object.assign(next, { rate: 0.7, volume: 1, pitch: 1, lang: 'en-US', ...options });
    utterance = next;
    activeOwner.value = owner;
    next.onstart = () => { if (utterance === next) speaking.value = true; };
    const finish = () => {
      if (utterance !== next) return;
      utterance = null;
      activeOwner.value = null;
      speaking.value = false;
    };
    next.onend = finish;
    next.onerror = event => {
      if (utterance !== next) return;
      if (event.error !== 'canceled' && event.error !== 'interrupted') error.value = '发音播放失败，请重试';
      finish();
    };
    try { window.speechSynthesis.speak(next); }
    catch { error.value = '发音播放失败，请重试'; finish(); }
  };
  onBeforeUnmount(stopAudio);
  return { playAudio, stopAudio, error, isPlaying: computed(() => activeOwner.value === owner && speaking.value) };
};
