<template>
  <div class="page-container learned-page route-motion">
    <header class="page-heading learned-heading">
      <div><h1>已学单词</h1><p>{{ userStore.getUser ? `共 ${total.toLocaleString()} 个单词 · 每组复习 10 个` : '登录后查看自己的学习记录' }}</p></div>
      <el-button type="primary" :disabled="!list.length || loading" @click="router.push('/learned/review')">开始复习</el-button>
    </header>
    <div class="learned-results" tabindex="0" aria-label="已学单词列表">
      <div v-if="!userStore.getUser" class="load-state"><p>登录后继续复习。</p><el-button type="primary" @click="signIn">登录</el-button></div>
      <el-skeleton v-else-if="loading && !list.length" :rows="6" animated />
      <div v-else-if="error && !list.length" class="load-state"><p>已学单词加载失败，请重试。</p><el-button @click="loadMore">重新加载</el-button></div>
      <el-empty v-else-if="!list.length" description="还没有已学单词，先完成一组课程学习吧。"><el-button @click="router.push('/courses/index?tab=my')">我的课程</el-button></el-empty>
      <div v-else class="word-grid">
        <article v-for="(word, index) in list" :key="word.id" class="word-card learned-word" :style="{ '--entrance-delay': `${(index < 20 ? Math.min(index, 4) * 30 : 0)}ms` }">
          <div class="learned-word-title"><h2>{{ word.word }}</h2><button :aria-label="`播放 ${word.word} 发音`" @click="playAudio(word.word)"><el-icon><VideoPlay /></el-icon></button></div>
          <p class="learned-phonetic">{{ word.phonetic }}</p>
          <p class="learned-definition">{{ word.definition }}</p>
          <p class="learned-translation">{{ word.translation }}</p>
        </article>
      </div>
      <div v-if="list.length && list.length < total" class="wordbook-load-more"><el-button :loading="loading" @click="loadMore">{{ error ? '加载失败，点击重试' : '加载更多' }}</el-button></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { useRouter } from 'vue-router';
import { VideoPlay } from '@element-plus/icons-vue';
import type { Word } from '@en/common/word';
import { getLearnedWords } from '@/apis/learn';
import { useUserStore } from '@/stores/user';
import { useLogin } from '@/hooks/useLogin';
import { useAudio } from '@/hooks/useAudio';
const router = useRouter();
const userStore = useUserStore();
const { login } = useLogin();
const { playAudio } = useAudio();
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
  loading.value = false; error.value = false;
}
async function loadMore() {
  if (loading.value || !userStore.getUser) return;
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
    page++;
  } catch { if (isCurrent()) error.value = true; }
  finally { if (isCurrent()) loading.value = false; }
}
async function signIn() { try { await login(); } catch {} }
watch(() => userStore.getUser?.id, reset, { flush: 'sync' });
usePageRefresh(async () => { reset(); await loadMore(); });
onBeforeUnmount(() => { disposed = true; version++; });
</script>
