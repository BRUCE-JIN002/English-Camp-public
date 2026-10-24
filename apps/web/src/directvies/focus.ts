import type { App, Plugin } from "vue";

export default {
  install(app: App) {
    app.directive("focus", {
      mounted(el: HTMLInputElement) {
        el.focus();
      },
    });
  },
} as Plugin;
