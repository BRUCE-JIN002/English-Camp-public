import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import router from "./router";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "element-plus/theme-chalk/dark/css-vars.css";
import "@/assets/base.css";
import "@/assets/theme.css";
import "@/assets/mobile-inputs.css";
import { initializeTheme } from "@/hooks/useTheme";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import focusPlugin from "@/directvies/focus";

const disposeTheme = initializeTheme();
if (import.meta.hot) import.meta.hot.dispose(disposeTheme);

const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

app.use(pinia);
app.use(router);
app.use(focusPlugin);
app.use(ElementPlus, {
  locale: zhCn,
});

app.mount("#app");
