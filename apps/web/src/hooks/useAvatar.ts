import { uploadUrl } from "@/apis";
import { useUserStore } from "@/stores/user";
import { computed, ref } from "vue";

export const useAvatar = () => {
  const userStore = useUserStore();
  const failedUrl = ref("");
  const customAvatar = (path?: string | null) => path ? uploadUrl + path : "";
  const avatar = computed(() => {
    const url = customAvatar(userStore.getUser?.avatar);
    return url === failedUrl.value ? "" : url;
  });
  const onAvatarError = () => {
    failedUrl.value = avatar.value;
  };
  return { avatar, customAvatar, onAvatarError };
};
