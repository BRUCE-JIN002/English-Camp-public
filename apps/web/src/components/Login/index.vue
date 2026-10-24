<template>
  <div
    v-if="isShowLogin"
    class="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
  />
  <Transition name="fade">
    <div
      v-if="isShowLogin"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 lg:p-10"
    >
      <div
        class="login-shell flex w-full overflow-hidden rounded-[20px] bg-white"
      >
        <!-- 欢迎文案搭配小型 3D 模型 -->
        <aside class="login-art login-welcome">
          <Transition name="auth-copy" mode="out-in">
          <h2 :key="loginType">{{ loginType === 'login' ? 'Hello again.' : 'Hello, friend.' }}<br>{{ loginType === 'login' ? '快乐，继续！' : '一起，出发！' }}</h2>
          </Transition>
          <p>收藏每一次进步，<br>让今天的你比昨天多会一点。</p>
          <div class="login-model-corner">
            <ModelViewer compact @changeType="changeType" ref="modelViewerRef" />
            <span>Ready?</span>
          </div>
        </aside>
        <button class="login-close" aria-label="关闭登录" @click="isShowLogin = false"><el-icon><Close /></el-icon></button>

        <!-- 右侧登录表单区域 -->
        <div
          class="login-form-panel relative flex flex-1 flex-col bg-white"
        >
          <Transition name="auth-form" mode="out-in">
          <div :key="loginType" class="login-form-content">
          <LoginForm v-if="loginType === 'login'" />
          <RegisterForm v-if="loginType === 'register'" />
          <div class="mt-6 text-center">
            <div
              class="flex items-center justify-center gap-4 text-sm text-gray-500"
            >
              <span
                class="cursor-pointer hover:text-indigo-600 transition-colors"
                >忘记密码？</span
              >
              <span class="text-gray-300">|</span>
              <button
                type="button"
                class="cursor-pointer hover:text-indigo-600 transition-colors"
                @click="switchByText"
              >
                {{ switchText }}
              </button>
            </div>
          </div>
          </div>
          </Transition>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import ModelViewer from "./ModelViewer.vue";
  import { Close } from "@element-plus/icons-vue";
  import LoginForm from "./LoginForm.vue";
  import RegisterForm from "./RegisterForm.vue";
  import {
    ref,
    inject,
    computed,
    watch,
    onBeforeUnmount,
    useTemplateRef,
  } from "vue";
  import { IS_SHOW_LOGIN } from "./type";
  import type { LoginType } from "./type";
  const loginType = ref<LoginType>("login");
  const isShowLogin = inject(IS_SHOW_LOGIN, ref(false));

  const modelViewerRef = useTemplateRef<{ loadModel: (type: LoginType) => void }>("modelViewerRef");

  const changeType = (type: LoginType) => {
    loginType.value = type;
  };

  const switchType = computed<LoginType>(() =>
    loginType.value === "login" ? "register" : "login",
  );
  const switchText = computed(() =>
    loginType.value === "login" ? "注册" : "登录",
  );
  const switchByText = () => {
    const type = switchType.value;
    changeType(type);
    modelViewerRef.value?.loadModel(type);
  };

  const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") isShowLogin.value = false; };
  window.addEventListener("keydown", onEscape);

  const lockScroll = () => {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  };
  const unlockScroll = () => {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  };

  watch(
    isShowLogin,
    (visible) => {
      if (visible) {
        lockScroll();
      } else {
        unlockScroll();
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", onEscape);
    unlockScroll();
  });
</script>

<style scoped>
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.2s ease;
  }
  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
</style>
