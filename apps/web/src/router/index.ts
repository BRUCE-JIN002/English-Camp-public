import { createRouter, createWebHistory } from "vue-router";
import home from "./home/index"; // 首页
import wordBook from "./word-book/index"; //单词页
import setting from "./setting/index"; // 设置页
import chat from "./chat/index"; // 聊天页
import learned from "./learned";
import course from "./course/index"; // 课程页

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [...home, ...wordBook, ...setting, ...chat, ...course, ...learned],
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { left: 0, top: 0 };
  },
});

export default router;
