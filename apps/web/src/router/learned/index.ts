import layout from "@/layout/index.vue";
import { useUserStore } from "@/stores/user";
export default [{ path: '/learned', component: layout, children: [
  { path: '', component: () => import('@/views/Learned/index.vue') },
  { path: 'review', component: () => import('@/views/Course/Learn/index.vue'), meta: { review: true }, beforeEnter: () => useUserStore().getUser ? true : { path: '/learned', replace: true } },
] }];
