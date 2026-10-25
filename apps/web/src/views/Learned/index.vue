<template>
  <div class="page-container learned-page route-motion">
    <header class="page-heading learned-heading">
      <div><h1>已学单词</h1><p>{{ userStore.getUser ? `共 ${total.toLocaleString()} 个单词 · 每组复习 10 个` : '登录后查看自己的学习记录' }}</p></div>
      <el-button type="primary" :disabled="!list.length || loading" @click="router.push('/learned/review')">开始复习</el-button>
    </header>
    <div ref="wordScroll" class="learned-results" tabindex="0" aria-label="已学单词列表">
      <div v-if="!userStore.getUser" class="load-state"><p>登录后继续复习。</p><el-button type="primary" @click="signIn">登录</el-button></div>
      <el-skeleton v-else-if="loading && !list.length" :rows="6" animated />
      <div v-else-if="error && !list.length" class="load-state"><p>已学单词加载失败，请重试。</p><el-button @click="loadMore">重新加载</el-button></div>
      <el-empty v-else-if="!list.length" description="还没有已学单词，先完成一组课程学习吧。"><el-button @click="router.push('/courses/index?tab=my')">我的课程</el-button></el-empty>
      <WordCards v-else :list="list" :masonry="false" />
      <div ref="loadTrigger" class="wordbook-load-more" aria-live="polite">
        <span v-if="loading && list.length">正在加载更多单词…</span>
        <el-button v-else-if="error && list.length" @click="loadMore">加载失败，点击重试</el-button>
        <span v-else-if="list.length && !hasMore">已显示全部单词</span>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import WordCards from '@/components/WordCards/index.vue';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { useRouter } from 'vue-router';
import type { Word } from '@en/common/word';
import { getLearnedWords } from '@/apis/learn';
import { useUserStore } from '@/stores/user';
import { useLogin } from '@/hooks/useLogin';
const mobileLayout = window.matchMedia('(max-width: 600px)');
const isMobile = ref(mobileLayout.matches);
const syncLayout = () => { isMobile.value = mobileLayout.matches; observeScroll(); };
onMounted(() => { observeScroll(); mobileLayout.addEventListener('change', syncLayout); });
onBeforeUnmount(() => { observer?.disconnect(); mobileLayout.removeEventListener('change', syncLayout); });
const wordScroll = ref<HTMLElement>();
const loadTrigger = ref<HTMLElement>();
const hasMore = ref(true);
let observer: IntersectionObserver | undefined;
function observeScroll() {
  observer?.disconnect();
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting) && !error.value) void loadMore();
  }, { root: isMobile.value ? wordScroll.value : null, rootMargin: '240px' });
  if (loadTrigger.value) observer.observe(loadTrigger.value);
}
function nearBottom() {
  const bounds = loadTrigger.value?.getBoundingClientRect();
  const viewport = isMobile.value ? wordScroll.value?.getBoundingClientRect() : undefined;
  return bounds && bounds.top <= (viewport?.bottom ?? window.innerHeight) + 240 && bounds.bottom >= (viewport?.top ?? 0);
}
const router = useRouter();
const userStore = useUserStore();
const { login } = useLogin();
const list = ref<Word[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref(false);
let page = 1;
let disposed = false;
let version = 0;
function reset() {
  version++;
  list.value = []; total.value = 0; page = 1;
  loading.value = false; error.value = false; hasMore.value = true;
}
async function loadMore() {
  if (disposed || loading.value || !hasMore.value || !userStore.getUser) return;
  const accountId = userStore.getUser.id;
  const requestVersion = ++version;
  const isCurrent = () => !disposed && version === requestVersion && accountId === userStore.getUser?.id;
  loading.value = true; error.value = false;
  try {
    const result = await getLearnedWords(page, 20);
    if (!isCurrent()) return;
    if (!result.success) throw new Error(result.message);
    total.value = result.data.total;
    const existing = new Set(list.value.map(word => word.id));
    list.value.push(...result.data.list.filter(word => !existing.has(word.id)));
    hasMore.value = result.data.list.length > 0 && page * 20 < total.value;
    page++;
  } catch { if (isCurrent()) error.value = true; }
  finally {
    if (isCurrent()) {
      loading.value = false;
      await nextTick();
      // Continue filling short viewports even when the sentinel stays visible.
      if (isCurrent() && !error.value && hasMore.value && nearBottom()) void loadMore();
    }
  }
}
async function signIn() { try { await login(); } catch {} }
watch(() => userStore.getUser?.id, reset, { flush: 'sync' });
usePageRefresh(async () => { reset(); await loadMore(); });
onBeforeUnmount(() => { disposed = true; version++; });
</script>
