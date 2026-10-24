<template>
  <div class="word-cards">
    <div class="word-grid">
      <div
        class="word-card h-full min-h-[220px] cursor-pointer bg-white text-gray-800"
        v-for="(item, index) in list"
        :key="item.id"
        v-masonry
        :data-tone="cardTone(item.id)"
        :role="isMobile ? 'button' : undefined"
        :tabindex="isMobile ? 0 : undefined"
        :aria-label="isMobile ? `查看 ${item.word} 的详情` : undefined"
        @click="openDetails(item)"
        @keydown.enter.self.prevent="openDetails(item)"
        @keydown.space.self.prevent="openDetails(item)"
        :style="{ '--entrance-delay': `${(index < 12 ? Math.min(index, 4) * 30 : 0)}ms` }"
      >
        <div class="">
          <div class="wordbook-card-title text-sm font-semibold text-blue-600 mb-1">
            {{ item.word }}
          </div>
          <div class="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <span class="wordbook-card-phonetic">{{ item.phonetic }}</span>
            <button type="button" class="wordbook-play" :aria-label="`播放 ${item.word} 发音`" @click.stop="playAudio(item.word)">
              <el-icon size="18" color="#2563EB"><VideoPlay /></el-icon>
            </button>
          </div>
          <div class="wordbook-card-summary text-sm text-gray-700 mb-1 overflow-hidden line-clamp-2">
            {{ item.definition }}
          </div>
          <div
            v-html="item.translation"
            class="wordbook-card-summary text-sm text-gray-600 mb-1 overflow-hidden line-clamp-2"
          ></div>
          <div
            class="wordbook-card-tags text-sm text-gray-600 mt-3 flex items-center gap-2 flex-wrap"
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
    <el-dialog v-model="detailsVisible" :title="selectedWord?.word ?? '单词详情'" class="wordbook-detail-dialog" modal-class="wordbook-detail-overlay" width="520px" align-center append-to-body destroy-on-close>
      <article v-if="selectedWord" class="wordbook-detail">
        <div class="wordbook-detail-pronunciation">
          <span>{{ selectedWord.phonetic || '暂无音标' }}</span>
          <el-button circle :aria-label="`播放 ${selectedWord.word} 发音`" @click="playAudio(selectedWord.word)"><el-icon><VideoPlay /></el-icon></el-button>
        </div>
        <section><h3>英文释义</h3><p>{{ selectedWord.definition || '暂无英文释义' }}</p></section>
        <section><h3>中文释义</h3><p>{{ detailTranslation || '暂无中文释义' }}</p></section>
        <section v-if="selectedWord.pos"><h3>词性</h3><p>{{ selectedWord.pos }}</p></section>
        <section v-if="selectedWord.exchange"><h3>词形变化</h3><p>{{ selectedWord.exchange }}</p></section>
        <div class="wordbook-detail-tags"><el-tag v-for="tag in detailTags" :key="tag" size="small">{{ tag }}</el-tag></div>
      </article>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
  import { ref, computed, onMounted, onBeforeUnmount, type Directive } from 'vue';
  import type { Word } from '@en/common/word';
  import { VideoPlay } from '@element-plus/icons-vue';
  import { useAudio } from '@/hooks/useAudio';
  defineProps<{ list: Word[] }>();
  // A stable pseudo-random color per word, independent of pagination and re-renders.
  const cardTone = (id: string) => {
    let hash = 2166136261;
    for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return (hash >>> 0) % 3;
  };
  // Measure intrinsic card height; grid spans keep DOM/keyboard reading order intact.
  const masonryObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const card = entry.target as HTMLElement;
      const span = String(Math.ceil(card.offsetHeight) + 8);
      if (card.style.getPropertyValue('--word-span') !== span) card.style.setProperty('--word-span', span);
    }
  });
  const vMasonry: Directive<HTMLElement> = {
    mounted: element => masonryObserver.observe(element),
    unmounted: element => masonryObserver.unobserve(element),
  };
  const { playAudio } = useAudio();
  const mobileLayout = window.matchMedia('(max-width: 600px)');
  const isMobile = ref(mobileLayout.matches);
  const detailsVisible = ref(false);
  const selectedWord = ref<Word | null>(null);
  const openDetails = (word: Word) => {
    if (!isMobile.value) return;
    selectedWord.value = word;
    detailsVisible.value = true;
  };
  const detailTranslation = computed(() => {
    const template = document.createElement('template');
    template.innerHTML = (selectedWord.value?.translation ?? '').replace(/<br\s*\/?\s*>/gi, '\n');
    return (template.content.textContent ?? '').replace(/\\n/g, '\n');
  });
  const detailTags = computed(() => {
    const tags = { gk: '高考', zk: '中考', gre: 'GRE', toefl: 'TOEFL', ielts: 'IELTS', cet6: '六级', cet4: '四级', ky: '考研' };
    return (Object.keys(tags) as Array<keyof typeof tags>).filter(key => selectedWord.value?.[key]).map(key => tags[key]);
  });

  const syncLayout = () => {
    isMobile.value = mobileLayout.matches;
    if (!isMobile.value) detailsVisible.value = false;
  };
  onMounted(() => mobileLayout.addEventListener('change', syncLayout));
  onBeforeUnmount(() => {
    masonryObserver.disconnect();
    mobileLayout.removeEventListener('change', syncLayout);
  });
</script>
