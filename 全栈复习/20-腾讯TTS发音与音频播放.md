# 腾讯 TTS 发音缓存与浏览器播放

词库、学习和复习页面共用腾讯云 TTS 发音链路。当前 useAudio 播放服务端 MP3，不是旧笔记中的 SpeechSynthesis；语音输入是另一个独立功能。

## 后端缓存与合成

GET /api/v1/word-book/pronunciation 接收 word。服务端检查字符串长度不超过 120、非空，并要求词库中精确存在，避免开放成任意文本合成服务。

缓存键由 word、voice、speed、codec、version 的序列化结果计算 SHA-256，写入 MinIO pronunciation 目录。同一进程相同键的请求复用 pending Promise；finally 删除 pending，失败后可以重试。

先读对象；只有 NoSuchKey/NotFound 才调用 TTS。存储故障直接返回 503，避免缓存坏了却不断产生合成费用。当前默认音色 501009，合成 MP3 后先入缓存再返回。

## 限流的实际范围

合成路径存在 IP 每分钟 30 次、进程全局每分钟 120 次和 pending 数量保护。Map 是内存状态，重启会清空，多实例不会共享；不能说成全局分布式限流。缓存命中不会进入这段合成限流。

IP 来自 req.ip；经过代理时还需明确 trust proxy 设置与可信代理范围，否则限流可能统计到代理地址。

## Range 与移动端

Controller 返回 audio/mpeg，并处理单段 bytes Range：合法请求返回 206、Content-Range 和相应字节；不合法返回 416。这里是从已加载的完整 Buffer 截取，不是对象存储的真正按需分段流式读取。

前端在用户点击处理函数中同步 new Audio 并调用 play，避免先 await 网络导致移动浏览器用户激活丢失。一个模块级 activeAudio 保证切词先停旧音频，每个组件用 Symbol 标记 owner，卸载只清理自己正在播放的音频。

loading 与 speaking 分开，waiting 触发 25 秒超时，play Promise 失败展示提示。请求参数里的 v 目前是前端固定版本值，后端真正缓存版本来自合成配置，不是由这个参数决定音色。

## 验证练习

测试缓存命中不调用 TTS、相同单词并发只合成一次、存储故障不付费回源、合成失败后可重试、Range 边界和连续点击切词。单元测试之外，移动 Safari 的实际播放仍需浏览器验收。

## 源码定位

- [server/apps/server/src/word-book/pronunciation.service.ts](<../server/apps/server/src/word-book/pronunciation.service.ts>)
- [server/apps/server/src/word-book/word-book.controller.ts](<../server/apps/server/src/word-book/word-book.controller.ts>)
- [apps/web/src/hooks/useAudio.ts](<../apps/web/src/hooks/useAudio.ts>)
- [apps/web/src/components/PronunciationButton/index.vue](<../apps/web/src/components/PronunciationButton/index.vue>)
- [server/apps/server/src/word-book/pronunciation.service.spec.ts](<../server/apps/server/src/word-book/pronunciation.service.spec.ts>)
- [docs/pronunciation.md](<../docs/pronunciation.md>)
