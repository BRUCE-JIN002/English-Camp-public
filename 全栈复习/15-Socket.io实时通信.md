# Socket.IO 支付通知与身份验证

Socket.IO 在这里负责支付完成后的 UI 提示。持久化权益仍由服务端订单结算维护，消息只是提醒客户端刷新。

## 当前连接方式

useSocket 通过模块级变量复用连接，登录后连接，退出后断开并移除监听。transport 优先 websocket，失败可回退 polling，设置有限重连次数。开发环境默认连主 API 3000，生产默认同源，通过 `/socket.io/` 代理。

Gateway 从 handshake.query.userId 读取用户 ID，加入 `user_${userId}` 房间；settle 提交后向该房间发送 paymentSuccess。

## 房间并不等于鉴权

客户端可以自行填写 query.userId，当前 Gateway 没有验证 Token。因此房间实现了消息路由，尚未建立可信的用户身份边界。HTTP AuthGuard 不会自动保护 Socket 握手。

改进方式是在握手 middleware 或连接处理时验证 accessToken 与用户状态，服务端计算房间名；拒绝过期或不存在账号，退出和账号切换时重新建立正确会话。这个方案尚未在当前 Gateway 落实。

## 消息为何不能作为付款凭证

断线、重连或服务器重启都可能让通知错过。数据库结算成功后，status 查询可以确认权益；不能让浏览器仅凭一个事件直接授予后端学习权限。多实例部署还需要跨实例消息适配，当前代码没有配置 Socket.IO Redis adapter。

## 复习练习

分别验证连接成功、通知时断线、退出后连接清理、重连后状态查询。代理层检查 Upgrade/Connection 头；后端没有日志时看代理路径，握手成功但收不到事件时再检查房间和用户 ID。

HMR 存储和模块变量用于减少重复连接，不等于所有账号切换、监听注册场景都经过严格单例验证。

## 源码定位

- [server/apps/server/src/socket/socket.gateway.ts](<../server/apps/server/src/socket/socket.gateway.ts>)
- [apps/web/src/hooks/useSocket.ts](<../apps/web/src/hooks/useSocket.ts>)
- [apps/web/src/App.vue](<../apps/web/src/App.vue>)
- [apps/web/src/views/Course/components/Pay.vue](<../apps/web/src/views/Course/components/Pay.vue>)
- [deploy/nginx.docker.conf](<../deploy/nginx.docker.conf>)
