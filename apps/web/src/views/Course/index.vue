<template>
  <div class="courses-page route-motion min-h-[60vh]">
    <div class="page-container px-0 pt-12 pb-24">
      <!-- 标题 -->
      <header class="page-heading courses-heading">
        <p
          class="text-sm font-medium mb-2"
        >
          为下一次进步，选一门好课
        </p>
        <h1 class="text-4xl font-bold tracking-tight text-zinc-900">
          让学习，充满期待。
        </h1>
        <p class="mx-auto mt-3 max-w-md text-sm text-zinc-500">
          一次购买，长期有效 · 覆盖高考、考研、四六级、托福雅思等
        </p>
      </header>

      <el-tabs class="page-toolbar" type="card" v-model="currentTab" @tab-change="getList">
        <el-tab-pane name="list" label="精选课程"></el-tab-pane>
        <el-tab-pane
          v-if="userStore.user?.id"
          name="my"
          label="我的课程"
        ></el-tab-pane>
      </el-tabs>

      <!-- 课程列表 -->
      <div ref="courseScroll" class="course-results" tabindex="0" aria-label="课程列表">
      <Transition name="tab-fade" mode="out-in">
        <div :key="currentTab">
          <el-skeleton v-if="loading" :rows="8" animated />
          <div v-else-if="loadError" class="load-state" role="status"><h2>课程暂时没有加载成功</h2><p>请检查服务连接，再试一次。</p><el-button @click="getList">重新加载</el-button></div>
          <div v-else-if="list.length > 0" class="course-grid">
            <article
              v-for="(item, index) in list"
              :key="item.id"
              :style="{ '--entrance-delay': `${Math.min(index, 4) * 30}ms` }"
              :class="{
                'highlight-active': highlightId === item.id,
              }"
              class="course-card group bg-white rounded-2xl overflow-hidden border border-zinc-100 shadow-sm hover:shadow-lg hover:shadow-indigo-500/5 hover:border-indigo-100 transition-all duration-300 flex flex-col"
            >
              <div class="course-cover relative aspect-4/3 bg-zinc-100 overflow-hidden">
                <img
                  :src="imageSrc(item.url)"
                  :alt="item.name"
                  class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                />
                <div
                  class="course-badge absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur text-xs font-medium text-zinc-600 shadow-sm"
                >
                  词汇
                </div>
              </div>
              <div class="course-content p-5 flex-1 flex flex-col">
                <h2 class="text-base font-semibold text-zinc-900 line-clamp-1">
                  {{ item.name }}
                </h2>
                <p
                  class="mt-2 text-sm text-zinc-500 line-clamp-2 leading-relaxed flex-1"
                >
                  {{ item.description }}
                </p>
                <div
                  class="course-meta mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between gap-3"
                >
                  <span class="text-xs text-zinc-400 truncate"
                    >讲师 {{ item.teacher }}</span
                  >
                  <span class="text-lg font-bold text-indigo-600 shrink-0"
                    >¥{{ item.price }}</span
                  >
                </div>
                <button
                  type="button"
                  @click="openPay(item)"
                  class="mt-4 w-full py-2.5 rounded-xl text-sm font-medium text-indigo-600 border border-indigo-200 bg-white hover:bg-indigo-50 transition-colors cursor-pointer"
                >
                  {{ currentTab === "list" ? "购买课程" : "学习课程" }}
                </button>
              </div>
            </article>
          </div>
          <el-empty v-else description="暂无课程" />
        </div>
      </Transition>
      </div>
    </div>
    <!-- 支付弹窗 -->
    <CousePay v-model:modelValue="payVisible" :course="selectedCourse" @paid="onPaid" />
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, onBeforeUnmount, nextTick } from "vue";
  import type { Course, CourseList } from "@en/common/course";
  import { getCourseList, getMyCourse } from "@/apis/course";
  import { uploadUrl } from "@/apis";
  import { usePageRefresh } from "@/hooks/usePageRefresh";
  import CousePay from "./components/Pay.vue";
  import { useLogin } from "@/hooks/useLogin";
  import { useUserStore } from "@/stores/user";
  import { useRouter, useRoute } from "vue-router";

  const courseScroll = ref<HTMLElement>();
  const loading = ref(false);
  const loadError = ref(false);
  const route = useRoute();
  const list = ref<CourseList>([]); // 课程列表
  const selectedCourse = ref<Course | null>(null); // 选中的课程
  const payVisible = ref<boolean>(false); // 支付弹窗是否显示
  const currentTab = ref("list");
  const highlightId = ref<string | null>(null);
  const userStore = useUserStore();
  const { login } = useLogin();
  const router = useRouter();

  let requestVersion = 0;
  let disposed = false;
  onBeforeUnmount(() => { disposed = true; requestVersion++; });

  // 获取课程列表
  const getList = async () => {
    const version = ++requestVersion;
    const accountId = userStore.user?.id;
    const tab = currentTab.value;
    const isCurrent = () => !disposed && version === requestVersion && accountId === userStore.user?.id && tab === currentTab.value;
    if (courseScroll.value) courseScroll.value.scrollTop = 0;
    loading.value = true;
    loadError.value = false;
    try {
      const res = currentTab.value === "list" ? await getCourseList() : await getMyCourse();
      if (!isCurrent()) return;
      if (!res.success) throw new Error(res.message);
      list.value = res.data ?? [];
    } catch { if (isCurrent()) loadError.value = true; }
    finally { if (isCurrent()) loading.value = false; }
  };

  const onPaid = async () => {
    currentTab.value = 'my';
    await getList();
  };

  // 图片路径
  const imageSrc = (url: string) => {
    return uploadUrl + url;
  };

  // 打开支付/跳转
  const openPay = async (course: Course) => {
    if (currentTab.value === "list") {
      await login();
      const myRes = await getMyCourse();
      const purchasedIds = new Set((myRes.data ?? []).map((c: Course) => c.id));
      if (purchasedIds.has(course.id)) {
        currentTab.value = "my";
        await nextTick();
        getList();
        await nextTick();
        setTimeout(() => {
          highlightId.value = course.id;
          setTimeout(() => {
            highlightId.value = null;
            setTimeout(() => {
              highlightId.value = course.id;
              setTimeout(() => {
                highlightId.value = null;
                setTimeout(() => {
                  highlightId.value = course.id;
                  setTimeout(() => {
                    highlightId.value = null;
                  }, 250);
                }, 250);
              }, 250);
            }, 250);
          }, 250);
        }, 300);
        return;
      }
      payVisible.value = true;
      selectedCourse.value = course;
    } else {
      router.push(`/courses/learn/${course.id}/${course.name}`);
    }
  };

  watch(() => route.query.tab, (tab) => {
    if (tab === 'my' && userStore.user) currentTab.value = 'my';
    else if (tab === 'list') currentTab.value = 'list';
  }, { immediate: true });
  watch(() => userStore.user?.id, () => { list.value = []; }, { flush: 'sync' });
  usePageRefresh(async () => {
    if (!userStore.user && currentTab.value === 'my') currentTab.value = 'list';
    await getList();
  });
</script>

<style scoped>
  .tab-fade-enter-active,
  .tab-fade-leave-active {
    transition:
      opacity 0.25s ease,
      transform 0.25s ease;
  }
  .tab-fade-enter-from,
  .tab-fade-leave-to {
    opacity: 0;
    transform: translateY(4px);
  }

  .highlight-active {
    box-shadow:
      0 0 12px 4px rgba(250, 204, 21, 0.6),
      0 0 30px 8px rgba(250, 204, 21, 0.25);
  }
</style>
