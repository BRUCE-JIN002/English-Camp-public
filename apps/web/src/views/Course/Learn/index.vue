<template>
  <div class="learn-page min-h-[60vh]">
    <div class="page-container px-0 pt-8 pb-16 sm:pt-12 sm:pb-24">
      <header class="page-heading learn-heading">
        <h1 class="text-2xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
          {{ title }}
        </h1>
        <p class="mt-3 text-zinc-500 text-sm">{{ reviewMode ? "复习已学单词，每组 10 个。请根据释义和翻译拼写单词。" : "请根据释义和翻译拼写单词" }}</p>
        <button v-if="reviewMode" class="review-return" @click="router.push('/learned')">← 返回已学单词</button>
      </header>

      <el-skeleton v-if="isLoading" :rows="10" animated />

      <div v-else-if="loadError" class="load-state"><p>单词加载失败，请重试。</p><el-button @click="getWordListData">重新加载</el-button></div>
      <div v-else-if="list.length === 0" class="flex justify-center py-20">
        <el-empty :description="reviewMode ? '暂无可复习的单词，请先完成课程学习。' : '暂无单词或您尚未购买该课程'" />
      </div>

      <template v-else>
        <!-- 本组已学完 -->
        <div
          v-if="currentIndex >= list.length"
          class="text-center py-16 px-6 bg-white rounded-2xl border border-zinc-100 shadow-sm"
        >
          <p class="text-zinc-600 mb-6">本组 {{ list.length }} 个词已{{ reviewMode ? '复习' : '学习' }}完成</p>
          <div class="flex items-center justify-center gap-4">
            <el-button size="large" @click="goHome">
              今天就到这儿吧
            </el-button>
            <el-button type="primary" size="large" @click="nextRound">
              {{ reviewMode && reviewPage * 10 >= reviewTotal ? '从头再复习' : '再练一组' }}
            </el-button>
          </div>
        </div>

        <!-- 当前单词卡片 -->
        <div v-else>
          <div
            class="mb-4 flex items-center justify-between text-sm text-zinc-500"
          >
            <span>第 {{ currentIndex + 1 }} / {{ list.length }} 个</span>
          </div>
          <article
            class="practice-card bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden"
          >
            <div class="relative p-5 sm:p-10">
              <div class="flex justify-center mb-6">
                <div
                  :class="{ 'filter blur-md select-none': isWordBlurred }"
                  class="transition-all duration-300 min-h-10 flex flex-col items-center text-center"
                >
                  <div
                    class="text-2xl sm:text-3xl font-bold text-indigo-600 tracking-tight"
                  >
                    {{ currentWord?.word }}
                  </div>
                  <div class="flex items-center justify-center gap-2 mt-1">
                    <span
                      v-if="currentWord?.phonetic"
                      class="text-base text-zinc-500 font-mono"
                    >
                      {{ currentWord.phonetic }}
                    </span>
                    <PronunciationButton
                      v-if="currentWord?.word"
                      :key="currentWord.id"
                      :word="currentWord.word"
                    />
                  </div>
                </div>
                <el-icon
                  class="absolute! right-10 top-10 cursor-pointer text-slate-400 hover:text-indigo-400 transition-colors"
                  :size="18"
                  :title="isWordBlurred ? '点击显示单词' : '点击隐藏单词'"
                  @click="isWordBlurred = !isWordBlurred"
                >
                  <View v-if="isWordBlurred" />
                  <Hide v-else />
                </el-icon>
              </div>
              <!-- 释义 -->
              <div
                class="mb-4 rounded-lg bg-zinc-50/80 border border-zinc-100 p-4"
              >
                <p
                  class="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2"
                >
                  释义
                </p>
                <div
                  class="text-zinc-700 leading-relaxed prose prose-sm max-w-none"
                  v-html="currentWord?.definition"
                />
              </div>
              <!-- 翻译 -->
              <div class="rounded-lg bg-zinc-50/80 border border-zinc-100 p-4">
                <p
                  class="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2"
                >
                  翻译
                </p>
                <div
                  class="text-zinc-600 leading-relaxed whitespace-pre-line prose prose-sm max-w-none"
                  v-html="currentWord?.translation"
                />
              </div>
              <!--拼写练习-->
              <div class="mt-4 rounded-lg bg-zinc-50/80 border border-zinc-100 p-4">
                <p
                  class="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2"
                >
                  拼写
                </p>
                <div
                  class="spelling-fields"
                  :class="{ 'spelling-fields-short': wordList.length > 0 && wordList.length <= 10 }"
                  :style="{ '--letter-count': wordList.length }"
                >
                  <input
                    :maxlength="1"
                    ref="inputRefs"
                    @input="onInput(index)"
                    v-for="(item, index) in wordList"
                    @keydown="onKeyDown(index, $event)"
                    :key="index"
                    type="text"
                    v-model="item.input"
                    :class="{
                      'border-green-500!':
                        isCurrentWordAllTrue && item.isTrue === true,
                      'border-indigo-500!':
                        !isCurrentWordAllTrue && item.isTrue === true,
                      'border-red-500!': item.isTrue === false,
                    }"
                    class="spelling-input w-8 border-0 border-b-2 border-zinc-300 bg-transparent text-center text-xl font-bold outline-none focus:border-indigo-500 sm:w-10 sm:text-2xl"
                  />
                </div>
              </div>
              <!--控制按钮-->
              <div class="module-row justify-end">
                <el-button :disabled="currentIndex === 0" @click="pagePrev">上一个</el-button>
                <el-button type="primary" @click="pageNext">下一个</el-button>
              </div>
            </div>
          </article>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
  import {
    ref,
    onMounted,
    watch,
    nextTick,
    computed,
    useTemplateRef,
  } from "vue";
  import type { Word } from "@en/common/word";
  import { getWordList, saveWordsMaster, getLearnedWords } from "@/apis/learn";
  import { useRoute, useRouter } from "vue-router";
  import PronunciationButton from "@/components/PronunciationButton/index.vue";
  import { View, Hide } from "@element-plus/icons-vue";
  import { ElMessage } from "element-plus";
  import { useUserStore } from "@/stores/user";
  import confetti from "canvas-confetti";

  interface WordItem {
    letter: string;
    input: string;
    isTrue: boolean | undefined;
  }

  const route = useRoute();
  const router = useRouter();
  const userStore = useUserStore();
  const reviewMode = computed(() => route.meta.review === true);
  const title = computed(() => reviewMode.value ? '单词复习' : route.params.title || '我的课程');
  const reviewPage = ref(1);
  const reviewTotal = ref(0);
  const loadError = ref(false);
  const isLoading = ref<boolean>(false);
  const list = ref<Word[]>([]);
  const currentIndex = ref(0);
  const isWordBlurred = ref(true);
  const wordList = ref<WordItem[]>([]);
  const hasSaved = ref(false);
  const currentWord = computed<Word | undefined>(() => {
    return list.value[currentIndex.value];
  });
  const isCurrentWordAllTrue = computed<boolean>(() => {
    return (
      wordList.value.length > 0 &&
      wordList.value.every((item) => item.isTrue === true)
    );
  });

  const inputRefs = useTemplateRef<HTMLInputElement[]>("inputRefs");
  const focusFirstInput = () => {
    const inputs = inputRefs.value ?? [];
    inputs[0]?.focus();
  };

  // 监听当前单词变化
  watch(
    currentWord,
    async () => {
      isWordBlurred.value = true;
      const current = currentWord.value?.word || "";
      wordList.value = Array.from(current).map((letter) => ({
        letter,
        input: "",
        isTrue: undefined,
      }));
      await nextTick();
      focusFirstInput();
    },
    { immediate: true },
  );

  // 上一个单词
  const pagePrev = () => {
    if (currentIndex.value > 0) {
      currentIndex.value--;
    }
  };

  // 保存单词 mastered
  const saveWordMaster = async () => {
    if (hasSaved.value) return;
    if (reviewMode.value) {
      hasSaved.value = true;
      ElMessage.success('本组复习完成');
      return;
    }
    const wordIds = list.value.map((item) => item.id);
    const res = await saveWordsMaster(wordIds);
    if (res.code === 200) {
      hasSaved.value = true;
      userStore.updateUserWordNumber(res.data?.wordNumber || 0, res.data?.dayNumber);
      if (res.data?.checkedIn) {
        userStore.checkedIn = true;
      }
      ElMessage.success('已完成学习');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } else {
      ElMessage.error(res.message);
    }
  };

  // 下一组
  const nextRound = async () => {
    if (isLoading.value) return;
    if (reviewMode.value) reviewPage.value = reviewPage.value * 10 >= reviewTotal.value ? 1 : reviewPage.value + 1;
    await getWordListData();
  };

  const goHome = () => {
    router.push(reviewMode.value ? "/learned" : "/");
  };

  // 下一个单词
  const pageNext = () => {
    if (currentIndex.value <= list.value.length - 1) {
      const isCurrentWordTrue = wordList.value.every(
        (item) => item.isTrue === true,
      );
      if (!isCurrentWordTrue) {
        ElMessage.error("请拼写正确");
        return;
      }
      currentIndex.value++;
    }
  };

  // 学完全部单词自动保存
  watch(
    () => currentIndex.value,
    (newVal) => {
      if (newVal >= list.value.length && list.value.length > 0) {
        saveWordMaster();
      }
    },
  );

  // 输入单词
  const onInput = (index: number) => {
    const current = wordList.value[index];
    if (!current) {
      return;
    }
    current.isTrue = current.letter === current.input;

    nextTick(() => {
      const inputs = inputRefs.value as HTMLElement[];
      if (index < inputs.length - 1) {
        inputs[index + 1]?.focus();
      }
    });
  };

  // 键盘事件
  const onKeyDown = (index: number, event: KeyboardEvent) => {
    if (event.key === "Enter") {
      if (isCurrentWordAllTrue.value) {
        event.preventDefault();
        pageNext();
      }
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      const current = wordList.value[index];
      if (current) {
        current.input = "";
        current.isTrue = undefined;
        nextTick(() => {
          const inputs = inputRefs.value as HTMLElement[];
          if (index > 0) {
            inputs[index - 1]?.focus();
          }
        });
      }
    }
    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      const current = wordList.value[index];
      const nextItem = wordList.value[index + 1];
      if (current?.input && index < wordList.value.length - 1 && nextItem) {
        event.preventDefault();
        nextItem.input = event.key;
        nextItem.isTrue = nextItem.letter === event.key;
        nextTick(() => {
          const inputs = inputRefs.value as HTMLElement[];
          if (index + 1 < inputs.length) {
            inputs[index + 1]?.focus();
          }
        });
      }
    }
  };

  // 获取单词列表
  const getWordListData = async () => {
    isLoading.value = true;
    loadError.value = false;
    try {
      const res = reviewMode.value
        ? await getLearnedWords(reviewPage.value, 10)
        : await getWordList(route.params.courseId as string);
      if (!res.success) throw new Error(res.message);
      if (reviewMode.value) {
        const data = res.data as { list: Word[]; total: number };
        list.value = data.list;
        reviewTotal.value = data.total;
      } else list.value = res.data as Word[];
      currentIndex.value = 0;
      hasSaved.value = false;
      await nextTick();
      focusFirstInput();
    } catch { loadError.value = true; }
    finally { isLoading.value = false; await nextTick(); focusFirstInput(); }
  };

  watch(() => route.path, () => { reviewPage.value = 1; void getWordListData(); });

  onMounted(async () => {
    await getWordListData();
  });
</script>

<style scoped>
.spelling-fields {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 16px auto 0;
}
.spelling-fields .spelling-input { width: 28px; min-width: 0; height: 36px; padding: 0; }
.spelling-fields-short {
  display: grid;
  grid-template-columns: repeat(var(--letter-count), minmax(0, 1fr));
  width: min(100%, calc(var(--letter-count) * 36px - 8px));
}
.spelling-fields-short .spelling-input { width: 100%; }
@media (min-width: 601px) {
  .spelling-fields .spelling-input { width: 36px; height: 40px; }
  .spelling-fields-short { width: min(100%, calc(var(--letter-count) * 44px - 8px)); }
  .spelling-fields-short .spelling-input { width: 100%; }
}
</style>
