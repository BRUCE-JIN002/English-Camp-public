import { nextTick, readonly, ref } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'system';
const storageKey = 'english-camp-theme';
const normalize = (value: unknown): ThemeMode =>
  value === 'light' || value === 'dark' ? value : 'system';
const themeMode = ref<ThemeMode>(normalize(document.documentElement.dataset.themeMode));
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
let activeTransition: ViewTransition | undefined;
let themeChangeId = 0;

function applyTheme() {
  const dark = themeMode.value === 'dark' || (themeMode.value === 'system' && systemTheme.matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.documentElement.dataset.themeMode = themeMode.value;
}

export function initializeTheme() {
  applyTheme();
  const onSystemChange = () => {
    if (themeMode.value === 'system') applyTheme();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) {
      themeMode.value = normalize(event.newValue);
      applyTheme();
    }
  };
  systemTheme.addEventListener('change', onSystemChange);
  window.addEventListener('storage', onStorage);
  return () => {
    systemTheme.removeEventListener('change', onSystemChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function useTheme() {
  const setTheme = async (mode: ThemeMode, origin?: { x: number; y: number }) => {
    const changeId = ++themeChangeId;
    if (activeTransition) {
      activeTransition.skipTransition();
      await activeTransition.finished.catch(() => {});
    }
    if (changeId !== themeChangeId) return;
    const nextMode = normalize(mode);
    const nextDark = nextMode === 'dark' || (nextMode === 'system' && systemTheme.matches);
    const update = () => {
      themeMode.value = nextMode;
      applyTheme();
      try { localStorage.setItem(storageKey, nextMode); } catch {}
    };
    if (!document.startViewTransition ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        nextDark === document.documentElement.classList.contains('dark')) {
      update();
      return;
    }
    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? 0;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const transition = document.startViewTransition(async () => {
      update();
      await nextTick();
    });
    activeTransition = transition;
    try {
      await transition.ready;
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 500, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
      );
    } catch {
      // A skipped transition still applies the requested theme.
    } finally {
      await transition.finished.catch(() => {});
      if (activeTransition === transition) activeTransition = undefined;
    }
  };
  return { themeMode: readonly(themeMode), setTheme };
}
