import { computed, onBeforeUnmount, ref } from 'vue';

export interface Options {
  rate?: number;
  volume?: number;
}
let activeAudio: HTMLAudioElement | null = null;
let loadTimer: ReturnType<typeof setTimeout> | undefined;
const activeOwner = ref<symbol | null>(null);
const speaking = ref(false);
const loading = ref(false);

function stopCurrent() {
  clearTimeout(loadTimer);
  const previous = activeAudio;
  activeAudio = null;
  activeOwner.value = null;
  speaking.value = false;
  loading.value = false;
  if (previous) {
    previous.onplaying = previous.onwaiting = previous.onended = previous.onerror = null;
    previous.pause();
    previous.removeAttribute('src');
    previous.load();
  }
}

// Shared Tencent Cloud pronunciation player for vocabulary, learning, and review.
export const useAudio = (options: Options = {}) => {
  const owner = Symbol('pronunciation');
  const error = ref('');
  const stopAudio = () => { if (activeOwner.value === owner) stopCurrent(); };
  const playAudio = (word: string) => {
    if (!word.trim()) return;
    error.value = '';
    stopCurrent();
    // Set the same-origin URL and call play synchronously within the click gesture.
    // Awaiting a fetch before play can lose iOS user activation.
    const next = new Audio(`/api/v1/word-book/pronunciation?v=501009&word=${encodeURIComponent(word.trim())}`);
    activeAudio = next;
    activeOwner.value = owner;
    loading.value = true;
    next.volume = Math.max(0, Math.min(1, options.volume ?? 1));
    next.playbackRate = Math.max(0.5, Math.min(2, options.rate ?? 1));
    const fail = (message: string) => {
      if (activeAudio !== next) return;
      stopCurrent();
      error.value = message;
    };
    const waitForAudio = () => {
      if (activeAudio !== next) return;
      speaking.value = false;
      loading.value = true;
      clearTimeout(loadTimer);
      loadTimer = setTimeout(() => fail('发音加载超时，请重试'), 25_000);
    };
    next.onplaying = () => {
      if (activeAudio !== next) return;
      clearTimeout(loadTimer);
      loading.value = false;
      speaking.value = true;
    };
    next.onwaiting = waitForAudio;
    next.onended = () => { if (activeAudio === next) stopCurrent(); };
    next.onerror = () => fail('发音加载失败，请稍后重试');
    waitForAudio();
    try {
      void next.play().catch(reason => fail(reason?.name === 'NotAllowedError'
        ? '请点击喇叭播放发音' : '发音播放失败，请重试'));
    } catch { fail('发音播放失败，请重试'); }
  };
  onBeforeUnmount(stopAudio);
  return {
    playAudio, stopAudio, error,
    isPlaying: computed(() => activeOwner.value === owner && speaking.value),
    isLoading: computed(() => activeOwner.value === owner && loading.value),
  };
};
