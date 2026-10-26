# JWT 双 Token 与刷新竞态

JWT 的签名用来验证内容是否由可信签发方产生，payload 解码本身不等于验签。当前 HTTP 登录体系使用 accessToken 与 refreshToken，以 tokenType 区分用途。

## 当前有效期必须如实描述

SharedModule 设置默认 expiresIn 为 7d；生成 accessToken 没有覆盖它；refreshToken 也显式设置 7d。所以**两个 Token 当前都是 7 天**。旧笔记“短 access 加长 refresh”的说法只是常见设计，尚未落实到这里。

AuthGuard 检查签名、有效期、tokenType 为 access、userId 存在且数据库账号仍在，然后写入 request.user。刷新接口只接受 refresh 类型，并重新查用户后签发两个新 Token。账号删除后，尚未过期的 Token 也会被用户存在性检查拒绝。

## 两套前端刷新路径

业务 Axios：遇到 401，用 isRefreshing 防止同一实例重复刷新，其他请求将回调加入 requestQueue。成功后更新 Pinia 并重试。refreshTokenApi 使用独立 Axios，避免刷新接口进入同一 401 链。

AI 请求：getChatAccessToken 解码 exp，如果距离过期大于 30 秒则直接使用，否则复用 pendingRefresh Promise。刷新结束还检查 refreshToken 是否仍属于当前会话，避免给切换后的账号写入旧凭证。这里解码只用于提前刷新，最终有效性仍由服务器验签决定。

## 尚未闭合的边界

业务 Axios 队列只保存成功回调，刷新失败后清空队列，等待者可能一直 pending；重试也没有明确的单次标记。没有 response 的超时错误访问 error.response.status 还可能产生二次错误。业务 API 与 AI 的刷新锁分离，不能宣称所有网络请求全局只刷新一次。

后端没有 refresh token 存储、撤销版本或一次性轮换记录。签发新 refreshToken 并不会自动让旧的失效。Pinia 持久化保存会话，需考虑页面脚本注入对凭证的影响。

## 改进练习

设计统一的 single-flight 刷新 Promise，让成功和失败都传播给所有等待者；限制原请求最多重试一次；请求发出、刷新完成、重试之前检查会话版本。后端再按需要引入短 access、refresh 轮换与撤销记录。

测试并发 401、刷新失败、刷新期间退出、重试后仍然 401 四条路径。不要把“Token 存在”当成“用户授权访问任意资源”。

## 源码定位

- [server/apps/server/src/auth/auth.service.ts](<../server/apps/server/src/auth/auth.service.ts>)
- [server/libs/shared/src/shared.module.ts](<../server/libs/shared/src/shared.module.ts>)
- [server/libs/shared/src/auth/auth.guard.ts](<../server/libs/shared/src/auth/auth.guard.ts>)
- [server/apps/server/src/user/user.service.ts](<../server/apps/server/src/user/user.service.ts>)
- [apps/web/src/apis/index.ts](<../apps/web/src/apis/index.ts>)
- [apps/web/src/apis/chat/auth.ts](<../apps/web/src/apis/chat/auth.ts>)
- [apps/web/src/apis/auth/index.ts](<../apps/web/src/apis/auth/index.ts>)
