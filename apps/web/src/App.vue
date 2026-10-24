<template>
  <RouterView />
  <Seearch />
  <Login />
  <PortraitGuard />
</template>

<script setup lang="ts">
  import { RouterView } from "vue-router";
  import Login from "./components/Login/index.vue";
  import PortraitGuard from "./components/PortraitGuard/index.vue";
  import Seearch from "./components/Search/index.vue";
  import { ref, provide, watch } from "vue";
  import { IS_SHOW_LOGIN } from "./components/Login/type";
  import { useSocket } from "./hooks/useSocket";
  import { useUserStore } from "./stores/user";
  import { usePageRefresh } from "./hooks/usePageRefresh";
  import { getCheckInStatus } from "./apis/learn";
  import { syncUserStats } from "./apis/user";
  import { Tracker } from "@en/tracker";
  provide(IS_SHOW_LOGIN, ref(false)); // 登录弹窗是否显示, 并且扩展为全局调用 默认不显示

  const userStore = useUserStore();
  const tracker = new Tracker({
    userId: userStore.user?.id,
    baseUrl: "/api/v1",
    uv: {
      api: "/tracker/uv",
      updateApi: "/tracker/update-uv",
    },
    pv: {
      api: "/tracker/pv",
    },
    event: {
      api: "/tracker/event",
    },
    error: {
      api: "/tracker/error",
    },
    performance: {
      api: "/tracker/performance",
    },
  });

  const { connect, disconnect } = useSocket();
  watch(
    () => userStore.user?.id,
    (newVal) => {
      void tracker.setUserId(newVal).catch(() => {});
      if (newVal) {
        connect();
      } else {
        disconnect();
      }
    },
    { immediate: true, flush: "sync" },
  );

  usePageRefresh(async (isCurrent) => {
    if (!userStore.user) return;
    await Promise.allSettled([
      syncUserStats().then((res) => {
        if (isCurrent() && userStore.user && res.success && res.data) {
          // Preserve this session's tokens; /me never returns credentials.
          Object.assign(userStore.user, res.data);
        }
      }),
      getCheckInStatus().then((res) => {
        if (isCurrent() && userStore.user && res.success) {
          userStore.checkedIn = res.data.checkedIn;
        }
      }),
    ]);
  });
</script>
