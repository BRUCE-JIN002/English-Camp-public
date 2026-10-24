import { useSocket } from "@/hooks/useSocket";
import { IS_SHOW_LOGIN } from "@/components/Login/type";
import { inject, ref } from "vue";
import { useUserStore } from "@/stores/user";
import router from "@/router";

export const useLogin = () => {
  const isShowLogin = inject(IS_SHOW_LOGIN, ref(false));
  const userStore = useUserStore();

  const login = () => {
    return new Promise((resolve, reject) => {
      if (userStore.getUser) {
        resolve(true);
      } else {
        isShowLogin.value = true;
        reject(false);
      }
    });
  };

  const hide = () => {
    isShowLogin.value = false;
  };

  const logout = () => {
    useSocket().disconnect();
    userStore.logout();
    router.replace("/"); //跳转到首页
  };

  return {
    login,
    hide,
    logout,
  };
};
