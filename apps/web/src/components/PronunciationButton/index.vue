<template>
  <button type="button" class="pronunciation-button" :class="{ 'is-playing': isPlaying }" :aria-label="`${isPlaying ? '正在播放' : '播放'} ${word} 发音`" :aria-busy="isPlaying" @click.stop="playAudio(word)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path class="sound-wave wave-near" d="M15 8a6 6 0 0 1 0 8" />
      <path class="sound-wave wave-far" d="M18 5a10 10 0 0 1 0 14" />
    </svg>
  </button>
</template>
<script setup lang="ts">
import { watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useAudio } from '@/hooks/useAudio';
defineProps<{ word: string }>();
const { playAudio, isPlaying, error } = useAudio();
watch(error, message => { if (message) ElMessage.warning(message); });
</script>
<style scoped>
.pronunciation-button { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 32px; height: 32px; padding: 6px; border: 0; border-radius: 50%; background: transparent; color: var(--el-text-color-secondary); cursor: pointer; transition: color 160ms ease, background-color 160ms ease; }
.pronunciation-button svg { display: block; width: 20px; height: 20px; flex-shrink: 0; }
.pronunciation-button.is-playing { color: var(--el-color-primary); background: color-mix(in srgb, var(--el-color-primary) 14%, transparent); }
.is-playing .sound-wave { animation: sound-spread 900ms ease-in-out infinite; transform-origin: 12px 12px; }
.is-playing .wave-far { animation-delay: 180ms; }
@keyframes sound-spread { 0%, 100% { opacity: .25; transform: scale(.9); } 50% { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .is-playing .sound-wave { animation: none; } .pronunciation-button { transition: none; } }
</style>
