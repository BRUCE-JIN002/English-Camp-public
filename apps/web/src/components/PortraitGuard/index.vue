<template>
  <dialog ref="notice" class="portrait-notice" aria-labelledby="portrait-title" aria-describedby="portrait-description" @cancel.prevent @touchmove.prevent @wheel.prevent>
    <div class="portrait-notice-content">
      <div class="portrait-symbol" aria-hidden="true">
        <svg viewBox="0 0 100 100" fill="none">
          <g class="portrait-phone">
            <rect x="37" y="27" width="26" height="46" rx="6" fill="#ffe443" stroke="currentColor" stroke-width="3" />
            <path d="M46.5 34h7" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </g>
          <path d="M78 28a34 34 0 0 1 3 41m0 0 1-12m-1 12 11-5M22 72a34 34 0 0 1-3-41m0 0-1 12m1-12L8 36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <h2 id="portrait-title">竖起手机，继续探索</h2>
      <p id="portrait-description">请将手机旋转至竖屏，体验更佳。</p>
      <span class="portrait-note">当前内容会保留</span>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';

const notice = ref<HTMLDialogElement>();
let previousFocus: HTMLElement | null = null;
const touchQuery = window.matchMedia('(any-pointer: coarse)');

function updateOrientation() {
  // Screen dimensions do not shrink when the on-screen keyboard opens.
  const isPhone = touchQuery.matches && Math.min(screen.width, screen.height) <= 600;
  const legacyAngle = (window as Window & { orientation?: number }).orientation;
  const landscape = screen.orientation?.type
    ? screen.orientation.type.startsWith('landscape')
    : typeof legacyAngle === 'number'
      ? Math.abs(legacyAngle) === 90
      : screen.width > screen.height;
  const dialog = notice.value;
  if (!dialog) return;
  if (isPhone && landscape && !dialog.open) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
  } else if ((!isPhone || !landscape) && dialog.open) {
    dialog.close();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }
}

onMounted(() => {
  updateOrientation();
  window.addEventListener('orientationchange', updateOrientation);
  window.addEventListener('resize', updateOrientation);
  screen.orientation?.addEventListener('change', updateOrientation);
  touchQuery.addEventListener('change', updateOrientation);
});
onBeforeUnmount(() => {
  window.removeEventListener('orientationchange', updateOrientation);
  window.removeEventListener('resize', updateOrientation);
  screen.orientation?.removeEventListener('change', updateOrientation);
  touchQuery.removeEventListener('change', updateOrientation);
  notice.value?.close();
});
</script>

<style scoped>
.portrait-notice {
  position: fixed; inset: 0; box-sizing: border-box;
  width: 100%; height: 100%; max-width: none; max-height: none;
  margin: 0; padding: 20px; border: 0;
  background: var(--el-bg-color); color: var(--el-text-color-primary);
  overscroll-behavior: none; touch-action: none;
}
.portrait-notice[open] { display: grid; place-items: center; }
.portrait-notice::backdrop { background: var(--el-bg-color); }
.portrait-notice-content { text-align: center; }
.portrait-symbol { width: 88px; height: 88px; margin: 0 auto 18px; border-radius: 24px; background: #ffe443; color: #7042d9; }
.portrait-symbol svg { width: 100%; height: 100%; }
.portrait-phone { transform-box: view-box; transform-origin: 50% 50%; }
.portrait-notice[open] .portrait-phone { animation: phone-to-portrait 3.2s cubic-bezier(.22, 1, .36, 1) infinite; }
@keyframes phone-to-portrait {
  0%, 15% { transform: rotate(-90deg); opacity: 1; }
  50%, 80% { transform: rotate(0); opacity: 1; }
  88% { transform: rotate(0); opacity: 0; }
  89%, 94% { transform: rotate(-90deg); opacity: 0; }
  100% { transform: rotate(-90deg); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .portrait-notice[open] .portrait-phone { animation: none; }
}
h2 { margin: 0 0 10px; font-size: 24px; font-weight: 800; }
p { margin: 0; font-size: 14px; color: var(--el-text-color-regular); }
.portrait-note { display: block; margin-top: 18px; font-size: 12px; color: var(--el-text-color-secondary); }
</style>
