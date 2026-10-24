<template>
  <div
    class="page-container wordbook-page route-motion"
  >
    <div class="page-heading wordbook-heading">
      <div class="flex items-center gap-2">
        <el-icon color="#2563EB" size="20">
          <Reading />
        </el-icon>
        <span class="text-2xl font-bold text-gray-800"
          >把新单词，变成老朋友。</span
        >
      </div>
      <div class="text-sm text-gray-600 mt-2">
        词典来源：牛津、柯林斯、BNC、FRQ、高考、中考、GRE、TOEFL、IELTS、大学英语六级、大学英语四级、考研
      </div>
      <p class="wordbook-count" aria-live="polite">{{ initialLoading ? '正在统计单词…' : loadError && !list.length ? '单词数量暂不可用' : `共 ${total.toLocaleString()} 个单词` }}</p>
    </div>
    <div class="page-toolbar module-row mb-10 mt-4 gap-2">
      <el-input
        @keyup.enter="searchWord"
        class="w-full max-w-xs"
        v-model="query.word"
        placeholder="请输入单词"
      ></el-input>
      <el-button @click="searchWord" type="primary">搜索</el-button>
      <div class="wordbook-filters module-row gap-2">
        <el-checkbox v-model="query.gk">高考</el-checkbox>
        <el-checkbox v-model="query.zk">中考</el-checkbox>
        <el-checkbox v-model="query.gre">GRE</el-checkbox>
        <el-checkbox v-model="query.toefl">TOEFL</el-checkbox>
        <el-checkbox v-model="query.ielts">IELTS</el-checkbox>
        <el-checkbox v-model="query.cet6">六级</el-checkbox>
        <el-checkbox v-model="query.cet4">四级</el-checkbox>
        <el-checkbox v-model="query.ky">考研</el-checkbox>
      </div>
    </div>
    <div ref="wordScroll" class="wordbook-results" tabindex="0" aria-label="单词列表">
    <el-skeleton v-if="initialLoading" :rows="6" animated />
    <div v-else-if="loadError && !list.length" class="load-state" role="status"><h2>词库暂时没有加载成功</h2><p>请检查服务连接，再试一次。</p><el-button @click="searchWord">重新加载</el-button></div>
    <el-empty v-else-if="!list.length" description="没有找到匹配的单词，试试其他拼写或筛选条件。" />
    <div v-else class="word-grid">
      <div
        class="word-card h-full min-h-[220px] cursor-pointer bg-white text-gray-800"
        v-for="(item, index) in list"
        :key="item.id"
        :style="{ '--entrance-delay': `${(index < 12 ? Math.min(index, 4) * 30 : 0)}ms` }"
      >
        <div class="">
          <div class="text-sm font-semibold text-blue-600 mb-1">
            {{ item.word }}
          </div>
          <div class="text-sm text-gray-500 mb-1 flex items-center gap-2">
            {{ item.phonetic }}
            <el-icon size="18" color="#2563EB" @click="playAudio(item.word)">
              <VideoPlay />
            </el-icon>
          </div>
          <div class="text-sm text-gray-700 mb-1 overflow-hidden line-clamp-2">
            {{ item.definition }}
          </div>
          <div
            v-html="item.translation"
            class="text-sm text-gray-600 mb-1 overflow-hidden line-clamp-2"
          ></div>
          <div
            class="text-sm text-gray-600 mt-3 flex items-center gap-2 flex-wrap"
          >
            <el-tag v-if="item.gk" type="primary" size="small">高考</el-tag>
            <el-tag v-if="item.zk" type="primary" size="small">中考</el-tag>
            <el-tag v-if="item.gre" type="primary" size="small">GRE</el-tag>
            <el-tag v-if="item.toefl" type="primary" size="small">TOEFL</el-tag>
            <el-tag v-if="item.ielts" type="primary" size="small">IELTS</el-tag>
            <el-tag v-if="item.cet6" type="primary" size="small">六级</el-tag>
            <el-tag v-if="item.cet4" type="primary" size="small">四级</el-tag>
            <el-tag v-if="item.ky" type="primary" size="small">考研</el-tag>
          </div>
        </div>
      </div>
    </div>
    <div ref="loadTrigger" class="wordbook-load-more" aria-live="polite">
      <span v-if="loading && list.length">正在加载更多单词…</span>
      <template v-else-if="loadError && list.length"><span>加载失败，已有单词已保留。</span><el-button @click="loadMore">重试</el-button></template>
      <span v-else-if="list.length && !hasMore">已显示全部单词</span>
      <el-button v-else-if="list.length && hasMore" text @click="loadMore">加载更多</el-button>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
  import { getWordBookList } from "@/apis/word-book";
  import type { WordQuery, WordList } from "@en/common/word";
  import { Reading, VideoPlay } from "@element-plus/icons-vue";
  import { useAudio } from "@/hooks/useAudio";

  const { playAudio } = useAudio();
  const loading = ref(false);
  const hasMore = ref(true);
  const initialLoading = computed(() => loading.value && !list.value.length);
  const loadTrigger = ref<HTMLElement>();
  const wordScroll = ref<HTMLElement>();
  const mobileLayout = window.matchMedia('(max-width: 600px)');
  let observer: IntersectionObserver | undefined;
  let controller: AbortController | undefined;
  let requestVersion = 0;
  let disposed = false;
  let nextPage = 1;
  const loadError = ref(false);
  const total = ref<WordList["total"]>(0);
  const list = ref<WordList["list"]>([]);
  const query = ref<WordQuery>({
    page: 1,
    pageSize: 12,
    word: "",
    gk: false,
    zk: false,
    gre: false,
    toefl: false,
    ielts: false,
    cet6: false,
    cet4: false,
    ky: false,
  });
  let appliedQuery = { ...query.value };
  const nearBottom = () => {
    const bounds = loadTrigger.value?.getBoundingClientRect();
    const viewport = mobileLayout.matches ? wordScroll.value?.getBoundingClientRect() : undefined;
    return bounds && bounds.top <= (viewport?.bottom ?? window.innerHeight) + 240 && bounds.bottom >= (viewport?.top ?? 0);
  };
  const searchWord = () => {
    ++requestVersion;
    controller?.abort();
    loading.value = false;
    loadError.value = false;
    list.value = [];
    total.value = 0;
    nextPage = 1;
    if (wordScroll.value) wordScroll.value.scrollTop = 0;
    hasMore.value = true;
    appliedQuery = { ...query.value, word: query.value.word?.trim(), page: 1 };
    void loadMore();
  };
  const loadMore = async () => {
    if (disposed || loading.value || !hasMore.value) return;
    const version = requestVersion;
    const page = nextPage;
    controller = new AbortController();
    loading.value = true;
    loadError.value = false;
    try {
      const res = await getWordBookList({ ...appliedQuery, page }, controller.signal);
      if (disposed || version !== requestVersion) return;
      if (!res.success) throw new Error(res.message);
      total.value = res.data.total;
      const knownIds = new Set(list.value.map(item => item.id));
      list.value.push(...res.data.list.filter(item => !knownIds.has(item.id)));
      nextPage = page + 1;
      hasMore.value = res.data.list.length > 0 && page * appliedQuery.pageSize < total.value;
    } catch {
      if (!disposed && version === requestVersion) loadError.value = true;
    } finally {
      if (!disposed && version === requestVersion) {
        loading.value = false;
        await nextTick();
        if (!loadError.value && hasMore.value && nearBottom()) void loadMore();
      }
    }
  };
  watch(() => [query.value.gk, query.value.zk, query.value.gre, query.value.toefl,
    query.value.ielts, query.value.cet6, query.value.cet4, query.value.ky], searchWord);
  const observeScroll = () => {
    observer?.disconnect();
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && !loadError.value) void loadMore();
    }, { root: mobileLayout.matches ? wordScroll.value : null, rootMargin: '240px' });
    if (loadTrigger.value) observer.observe(loadTrigger.value);
  };
  onMounted(() => {
    observeScroll();
    mobileLayout.addEventListener('change', observeScroll);
    searchWord();
  });
  onBeforeUnmount(() => {
    disposed = true;
    ++requestVersion;
    controller?.abort();
    observer?.disconnect();
    mobileLayout.removeEventListener('change', observeScroll);
  });
</script>
