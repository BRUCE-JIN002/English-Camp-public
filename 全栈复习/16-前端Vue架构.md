# Vue 页面状态网络与生命周期

前端由 Vue 3、TypeScript、Pinia、Vue Router 和 Element Plus 构成，Tailwind 与普通 CSS 共同负责样式。掌握状态归属比记组件名称更有价值。

## 状态应该放在哪里

| 状态 | 当前位置 | 生命周期 |
| --- | --- | --- |
| 用户资料、Token、打卡标记 | Pinia user，启用持久化 | 可跨页面和刷新保留 |
| 各角色消息和流控制器 | Chat 页面 Conversation Map | 页面实例存活期间 |
| 最后选中的角色 | chatSelection 模块 Map，按 userId | 路由切换保留，刷新重置 |
| 播放中的音频 | useAudio 模块级状态 | 多组件共享，所有者卸载时清理 |
| 路由数据刷新版本 | usePageRefresh 闭包 | 当前组件生命周期 |

持久化状态不代表服务端事实最新。App 使用 getMe 和打卡接口刷新统计，并用 isCurrent 防止旧请求覆盖新账号；更新资料时保留 Token。

## API 与路由

serverApi 面向 `/api/v1`，aiApi 面向 `/ai/v1`；聊天 SSE 单独封装。业务 Axios 与 AI 续期路径不同，具体竞态见 JWT 篇。页面按模块组织路由，history 使用 import.meta.env.BASE_URL。

开发 Vite 代理负责同源请求，生产由 Nginx 接手。不能认为 Vite proxy 会随静态 dist 一起部署。静态 3D 模型路径也必须结合 BASE_URL，避免子路径页面去站点根目录加载错误资源。

## 组件与副作用

Composition API 用 ref/reactive 保存状态，用 computed 推导展示，用 watch 响应路由和用户变化。网络、媒体、事件监听等副作用要有清理逻辑：页面卸载终止流，音频 owner 清理播放，refresh hook 移除前台事件。

provide/inject 在 App 向登录弹窗共享显示状态；共享包给前后端类型契约，但不会自动校验网络返回值。

## 不要过度描述优化

懒加载路由可以拆分包，但“首页静态导入”并不保证首屏更快，需要实际体积与加载指标。当前界面已有移动布局与横竖屏相关处理，旧笔记“统一最小宽 1280 的桌面端”不能继续作为整体架构描述。

Bubble 用 marked.parse 后 v-html 渲染，当前调用处未见 HTML 净化。Markdown 支持不是 XSS 防护，应该将净化和链接规则作为后续改进。

## 源码定位

- [apps/web/src/main.ts](<../apps/web/src/main.ts>)
- [apps/web/src/router/index.ts](<../apps/web/src/router/index.ts>)
- [apps/web/src/stores/user.ts](<../apps/web/src/stores/user.ts>)
- [apps/web/src/stores/chatSelection.ts](<../apps/web/src/stores/chatSelection.ts>)
- [apps/web/src/hooks/usePageRefresh.ts](<../apps/web/src/hooks/usePageRefresh.ts>)
- [apps/web/src/views/Chat/components/Bubble.vue](<../apps/web/src/views/Chat/components/Bubble.vue>)
- [apps/web/src/components/Login/ModelViewer.vue](<../apps/web/src/components/Login/ModelViewer.vue>)
