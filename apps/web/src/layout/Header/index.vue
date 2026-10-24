<template>
  <header ref="headerElement" class="camp-header">
    <div class="page-container header-inner">
      <button class="camp-brand" @click="goHome" aria-label="English Camp 首页"><span class="brand-mark">e<span>✦</span></span><span>English Camp<small>你的快乐英语营地</small></span></button>
      <nav class="camp-nav" aria-label="主导航">
        <button v-for="route in routes" :key="route.path" @click="handleRouteClick(route)" :class="{ active: currentPath === route.path || (route.path === '/courses/index' && currentPath.startsWith('/courses/learn')) }" :aria-current="currentPath === route.path ? 'page' : undefined"><el-icon><component :is="route.icon" /></el-icon><span>{{ route.name }}</span></button>
      </nav>
      <div class="header-account">
        <el-popover ref="themePopover" popper-class="theme-popover" :width="156" :trigger="profileHoverEnabled ? ['hover', 'click'] : 'click'" :show-after="profileHoverEnabled ? 100 : 0" :hide-after="150" placement="bottom-end">
          <template #reference>
            <button ref="themeButton" class="theme-picker header-theme-picker" aria-label="切换主题">
              <el-icon aria-hidden="true"><Moon v-if="themeMode === 'dark'" /><Sunny v-else-if="themeMode === 'light'" /><Monitor v-else /></el-icon>
            </button>
          </template>
          <div class="theme-options" role="group" aria-label="主题模式">
            <button v-for="option in themeOptions" :key="option.value" :aria-pressed="themeMode === option.value" @click="onThemeChange(option.value)">
              <el-icon aria-hidden="true"><component :is="option.icon" /></el-icon>
              <span>{{ option.label }}</span>
              <el-icon v-if="themeMode === option.value" class="theme-option-check" aria-hidden="true"><Check /></el-icon>
            </button>
          </div>
        </el-popover>
        <span v-if="currentPath !== '/setting/index'" class="header-stat" title="打卡天数"><el-icon><Sunny /></el-icon>{{ userStore.getUser?.dayNumber ?? 0 }}</span>
        <button v-if="currentPath !== '/setting/index'" class="header-stat words" title="查看已学单词，开始复习" aria-label="已学单词，开始复习" @click="gotoPath('/learned', true)"><el-icon><Star /></el-icon>{{ userStore.getUser?.wordNumber ?? 0 }}</button>
        <button v-if="userStore.getUser" class="checkin-button" :disabled="checkedIn" @click="handleCheckIn"><el-icon><Check /></el-icon>{{ checkedIn ? '已打卡' : '打卡' }}</button>
        <el-popover ref="profilePopover" popper-class="profile-popover" :width="300" :trigger="profileHoverEnabled ? 'hover' : 'click'" :show-after="profileHoverEnabled ? 100 : 0" :hide-after="150">
          <template #reference><button class="profile-button" aria-label="打开账户菜单"><img v-if="avatar" :src="avatar" alt="用户头像" @error="onAvatarError"><span v-else class="guest-avatar" aria-hidden="true"><el-icon><User /></el-icon></span><span>{{ userStore.getUser?.name ?? '游客' }}</span></button></template>
          <Profile @onNavigate="closeProfilePopover" />
        </el-popover>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
  import {
    User,
    Sunny,
    Moon,
    Monitor,
    Star,
    HomeFilled,
    Notebook,
    MagicStick,
    Reading,
    Check,
  } from "@element-plus/icons-vue";
  import { useTheme, type ThemeMode } from "@/hooks/useTheme";
  import { useRouter } from "vue-router";
  import { ref, watch, computed, onMounted, onBeforeUnmount } from "vue";
  import { useUserStore } from "@/stores/user";
  import Profile from "../Profile/index.vue";
  import { useAvatar } from "@/hooks/useAvatar";
  import { useLogin } from "@/hooks/useLogin";
  import { doCheckIn } from "@/apis/learn";
  import confetti from "canvas-confetti";
  import { ElMessage, type PopoverInstance } from "element-plus";

  const { themeMode, setTheme } = useTheme();
  const headerElement = ref<HTMLElement>();
  let headerResizeObserver: ResizeObserver | undefined;
  onMounted(() => {
    const header = headerElement.value;
    if (!header) return;
    const updateHeight = () => document.documentElement.style.setProperty(
      "--camp-header-height", `${header.getBoundingClientRect().height}px`,
    );
    updateHeight();
    headerResizeObserver = new ResizeObserver(updateHeight);
    headerResizeObserver.observe(header);
  });
  onBeforeUnmount(() => {
    headerResizeObserver?.disconnect();
    document.documentElement.style.removeProperty("--camp-header-height");
  });
  const themePopover = ref<PopoverInstance>();
  const themeButton = ref<HTMLButtonElement>();
  const themeOptions: { value: ThemeMode; label: string; icon: typeof Sunny }[] = [
    { value: 'light', label: '亮色', icon: Sunny },
    { value: 'dark', label: '暗色', icon: Moon },
    { value: 'system', label: '跟随系统', icon: Monitor },
  ];
  const onThemeChange = (mode: ThemeMode) => {
    const rect = themeButton.value?.getBoundingClientRect();
    themePopover.value?.hide();
    void setTheme(mode, rect ? {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    } : undefined);
  };
  const router = useRouter();
  const currentPath = ref("");
  const profilePopover = ref<PopoverInstance>();
  const closeProfilePopover = () => profilePopover.value?.hide();
  const profileHoverQuery = window.matchMedia('(min-width: 601px) and (hover: hover) and (pointer: fine)');
  const profileHoverEnabled = ref(profileHoverQuery.matches);
  const updateProfileTrigger = () => {
    closeProfilePopover();
    profileHoverEnabled.value = profileHoverQuery.matches;
  };
  onMounted(() => profileHoverQuery.addEventListener('change', updateProfileTrigger));
  onBeforeUnmount(() => profileHoverQuery.removeEventListener('change', updateProfileTrigger));
  const userStore = useUserStore();
  const checkedIn = computed(() => userStore.checkedIn);
  const { avatar, onAvatarError } = useAvatar();
  const { login } = useLogin();

  const routes = [
    { path: "/", name: "主页", icon: HomeFilled, isAuth: false }, //不需要登录
    { path: "/chat/index", name: "AI 对话", icon: MagicStick, isAuth: true }, //需要登录
    { path: "/word-book/index", name: "词库", icon: Notebook, isAuth: false }, //不需要登录
    { path: "/courses/index", name: "课程", icon: Reading, isAuth: false }, //不需要登录
    { path: "/setting/index", name: "我的", icon: User, isAuth: true }, //需要登录
  ];

  type NavRoute = (typeof routes)[number];

  watch(
    () => router.currentRoute.value,
    (newVal) => {
      currentPath.value = newVal.path;
      closeProfilePopover();
    },
    {
      immediate: true,
    },
  );

  const gotoPath = async (path: string, isAuth = false) => {
    if (isAuth && !userStore.getUser) {
      try {
        await login();
      } catch {}
      if (!userStore.getUser) {
        return;
      }
    }
    await router.push(path);
  };

  const goHome = () => {
    router.push("/");
  };

  const handleCheckIn = async () => {
    if (userStore.checkedIn) return;
    const res = await doCheckIn();
    if (res.success) {
      userStore.checkedIn = true;
      userStore.updateDayNumber(res.data.dayNumber);
      ElMessage.success('打卡成功');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } else {
      ElMessage.warning(res.message);
    }
  };

  const handleRouteClick = async (route: NavRoute) => {
    const mobileSettings = route.path === "/setting/index" && window.matchMedia("(max-width: 600px)").matches;
    await gotoPath(route.path, route.isAuth && !mobileSettings);
  };

</script>
