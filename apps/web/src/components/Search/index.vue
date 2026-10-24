<template>
  <div
    v-if="isShow"
    class="fixed inset-0 z-40 h-full w-full bg-black/30 backdrop-blur-[2px]"
  />
  <Transition name="fade">
    <div v-if="isShow" class="fixed inset-0 z-50 p-4 pt-20 shadow-lg sm:p-8 sm:pt-20">
      <div
        :class="
          wordList.length > 0
            ? 'rounded-tr-[10px] rounded-tl-[10px]'
            : 'rounded-[10px]'
        "
        class="mx-auto flex w-full max-w-2xl items-center gap-2 bg-white p-3 shadow-lg"
      >
        <el-icon size="20">
          <Search />
        </el-icon>
        <input
          v-focus
          placeholder="搜索"
          type="text"
          v-model="search"
          class="w-full h-full text-sm border-none rounded-lg p-2 focus:outline-none"
        />
      </div>
      <div
        v-if="wordList.length > 0"
        class="mx-auto max-h-[70dvh] w-full max-w-2xl overflow-y-auto rounded-br-[10px] rounded-bl-[10px] border-t border-gray-200"
      >
        <div
          @click="copyWord(item.word)"
          v-for="item in wordList"
          :key="item.id"
          class="bg-white hover:bg-blue-50 text-gray-800 p-4 cursor-pointer shadow-sm hover:shadow-md"
        >
          <div class="text-sm font-semibold text-blue-600 mb-1">
            {{ item.word }}
          </div>
          <div
            v-html="item.translation"
            class="text-sm text-gray-700 mb-1 overflow-hidden line-clamp-2"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import { ref, customRef } from "vue";
  import { Search } from "@element-plus/icons-vue";
  import type { Word } from "@en/common/word";
  import { getWordBookList } from "@/apis/word-book";
  import { ElMessage } from "element-plus";
  const wordList = ref<Word[]>([]); //搜索结果
  const isShow = ref(false); //用来展示弹框的显示和隐藏的
  let timer: ReturnType<typeof setTimeout> | null = null;

  const search = customRef((track, trigger) => {
    let value = ""; //默认值
    return {
      get() {
        track(); //告诉vue追踪value的值
        return value;
      },
      set(newValue: string) {
        value = newValue;
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          console.log(value);
          getList();
          trigger(); //告诉vue触发value的值，从而触发依赖
        }, 500);
      },
    };
  });

  const getList = async () => {
    const res = await getWordBookList({
      word: search.value,
      page: 1,
      pageSize: 20,
    });
    if (res.success) {
      wordList.value = res.data.list;
    }
  };

  const copyWord = (word: string) => {
    try {
      navigator.clipboard.writeText(word); //localhost  / https
      ElMessage.success("复制成功");
    } catch (error) {
      ElMessage.error("复制失败");
    }
  };

  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "f" && e.ctrlKey) {
      e.preventDefault();
      isShow.value = true;
      document.body.style.overflow = "hidden";
    }
    if (e.key === "Escape") {
      isShow.value = false;
      search.value = "";
      document.body.style.overflow = "auto";
    }
  });
</script>

<style scoped>
  .fade-enter-active,
  .fade-leave-active {
    transition: all 0.3s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
    transform: scale(0.5);
  }

  .fade-enter-to,
  .fade-leave-from {
    opacity: 1;
    transform: scale(1);
  }
</style>
