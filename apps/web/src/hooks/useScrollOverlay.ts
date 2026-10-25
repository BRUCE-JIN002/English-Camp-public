import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue';

/** Fade mobile controls over scrolling content without changing its layout. */
export function useScrollOverlay(container: Ref<HTMLElement | undefined>) {
  const collapsed = ref(false);
  const atTop = ref(true);
  const mobile = window.matchMedia('(max-width: 600px)');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let session = false;
  let previousTop = 0;
  const restore = () => {
    clearTimeout(timer);
    session = false;
    collapsed.value = false;
    previousTop = container.value?.scrollTop ?? 0;
    atTop.value = previousTop <= 4;
  };
  const scheduleRestore = () => {
    clearTimeout(timer);
    timer = setTimeout(restore, 650);
  };
  const start = () => {
    if (!mobile.matches) return;
    session = true;
    previousTop = container.value?.scrollTop ?? 0;
    scheduleRestore();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.target === container.value && ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) start();
  };
  const onScroll = () => {
    const top = Math.max(0, container.value?.scrollTop ?? 0);
    const delta = top - previousTop;
    previousTop = top;
    atTop.value = top <= 4;
    if (atTop.value) {
      clearTimeout(timer);
      collapsed.value = false;
      return;
    }
    if (!mobile.matches || !session) return;
    if (Math.abs(delta) > 2) collapsed.value = true;
    scheduleRestore();
  };
  onMounted(() => mobile.addEventListener('change', restore));
  onBeforeUnmount(() => {
    clearTimeout(timer);
    mobile.removeEventListener('change', restore);
  });
  return { collapsed, atTop, restore, start, onKey, onScroll };
}
