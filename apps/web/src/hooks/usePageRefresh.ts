import { onBeforeUnmount, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useUserStore } from "@/stores/user";

/** Refresh server data without remounting pages or discarding local drafts. */
export function usePageRefresh(refresh: (isCurrent: () => boolean) => void | Promise<void>) {
  const route = useRoute();
  const userStore = useUserStore();
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const schedule = () => {
    const current = ++revision;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (disposed) return;
      void Promise.resolve(refresh(() => !disposed && current === revision)).catch(() => {});
    }, 50);
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") schedule();
  };
  watch([() => route.fullPath, () => userStore.user?.id], schedule, { immediate: true, flush: "sync" });
  onMounted(() => {
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onVisible);
  });
  onBeforeUnmount(() => {
    disposed = true;
    revision++;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
    window.removeEventListener("pageshow", onVisible);
  });
}
