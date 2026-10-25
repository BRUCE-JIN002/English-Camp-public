# 单词发音：腾讯云 TTS

词库、已学单词、课程学习和复习通过同源接口播放 MP3：

`GET /api/v1/word-book/pronunciation?word=hello`

实现使用腾讯云官方 SDK 的 TextToVoice 接口。
默认音色为 501009（WeWinny 英文大模型女声），16 kHz MP3，服务端语速 0。
不提供任意文本合成：只接受词库中存在的词条，最多 120 个字符。

## 配置

本地复制 `server/.env.tts.example` 为 `server/.env.tts.local`，填入腾讯云凭据后重启 API。
该本地文件已经加入 .gitignore；不要使用项目 JWT 的 SECRET_KEY 代替腾讯云 SecretKey。
环境变量优先于本地文件。腾讯云账号须开通语音合成并有对应音色可用额度。

Docker 部署需把四个 TENCENT_TTS_* 配置项写入服务器的 `deploy/runtime.env`，
重新构建并发布前后端，重新创建 API 容器。本地的 .env.tts.local 不会自动同步到线上。

## 缓存与播放

MP3 按单词、音色、合成速度和版本的 SHA-256 保存至现有 MinIO 桶的 pronunciation/ 前缀。
同词并发请求合并；命中缓存不会调用腾讯云。缓存服务不可用时直接报错，避免重复付费生成。
生成失败不会写入缓存。更换音色可自然使用新缓存，无需修改数据库结构。

API 直接返回音频而不暴露 MinIO 内网地址，并支持 Safari 的 HTTP Range 请求。
前端在点击事件中立即调用 Audio.play()，避免先异步获取地址导致用户激活丢失。
声音动画以实际 playing 事件为准，加载中淡化按钮；切换单词或离开组件停止旧音频。
浏览器禁止自动播放时提示点击；云端失败时显示错误并允许重试，不切换其他发音来源。
所有页面通过公共 useAudio 方法和 PronunciationButton 组件播放腾讯云音频。

未缓存合成有进程级并发限制，以及每来源地址每分钟 30 次、全局每分钟 120 次限制。
当前不信任 X-Forwarded-For；反向代理后来源地址可能共享配额。多副本部署需要用网关或 Redis 统一限流。

## 验证

- `pnpm --filter @en/server exec jest --runInBand pronunciation.service.spec.ts pronunciation-player.spec.ts`
- `curl -o /tmp/word.mp3 'http://localhost:3000/api/v1/word-book/pronunciation?word=hello'`
- `curl -H 'Range: bytes=0-1' -i 'http://localhost:3000/api/v1/word-book/pronunciation?word=hello'`
- 第二次请求应返回同一音频且不再调用腾讯云。通过真实安卓/iOS 浏览器点击测试，自动播放限制仍以设备为准。

`UnsupportedOperation.PkgExhausted` 表示腾讯云当前资源包/额度不足，需在腾讯云控制台处理。
接口日志仅记录错误码，不记录密钥、签名和请求正文。

官方文档：https://cloud.tencent.com/document/product/1073/37995
