# 主 API 服务与 NestJS 请求生命周期

主 API 负责业务规则，Controller 接收 HTTP 参数，Service 组织业务动作，Prisma 访问数据。理解这一层能回答“为什么分模块”“鉴权放在哪里”和“异常如何返回”。

## 请求链路

`/api/v1/... → 按需 AuthGuard → Controller → Service → Prisma 或外部服务 → 响应拦截器`。

入口通过全局前缀 `api` 和 URI 版本 `1` 形成路径。Module 声明 imports、providers、controllers、exports；导出的 provider 才能通过模块边界注入。SharedModule 导出 Prisma、JWT、Response 等能力，每个应用必须建立自己的模块依赖图。

Controller 适合读取 `@Body`、`@Query`、`@Req`；Service 适合处理“先查课程、再创建订单、最后结算”等规则。只共享 TypeScript interface 不会产生运行时输入校验，不能把 DTO 类型当成 ValidationPipe。

## 响应协议的真实行为

成功拦截器输出 `{ timestamp, path, message, code, success, data }`，递归把 BigInt 转为字符串并保留 Date。这里存在一个需要记住的缺陷：`success` 固定为 true，Service 返回 `ResponseService.error` 仍可能得到 HTTP 200 与 `success: true`，只有业务 `code` 表示失败。

因此复习时要区分三层：HTTP 状态、业务 code、success 标志。当前调用方要结合实际 code 判断；后续应统一协议，并用真实 HTTP 异常表达失败，避免每个页面各自猜测。

异常过滤器捕获的是 HttpException，不是所有异常。未知数据库错误不会自动获得这套自定义响应格式。

SSE、音频和支付宝通知使用 `@Res()` 手动写响应。它们分别需要 `text/event-stream`、`audio/mpeg`、纯文本 success/failure，不能套普通 JSON 包装。

## 复习练习

沿着 `GET /api/v1/user/me` 找到 Guard、Controller、Service 和 select 字段，解释身份为何来自 Token。再比较 `POST /api/v1/pay/notify`：它不依赖用户登录，而依赖支付签名和订单核对。

验证一个新接口时至少检查未登录、参数非法、业务不存在和成功四条路径。单看 TypeScript 编译通过，不能证明这些 HTTP 语义正确。

## 源码定位

- [server/apps/server/src/main.ts](<../server/apps/server/src/main.ts>)
- [server/apps/server/src/app.module.ts](<../server/apps/server/src/app.module.ts>)
- [server/libs/shared/src/shared.module.ts](<../server/libs/shared/src/shared.module.ts>)
- [server/libs/shared/src/interceptor/interceptor.ts](<../server/libs/shared/src/interceptor/interceptor.ts>)
- [server/libs/shared/src/interceptor/exceptionFilter.ts](<../server/libs/shared/src/interceptor/exceptionFilter.ts>)
- [server/libs/shared/src/response/response.service.ts](<../server/libs/shared/src/response/response.service.ts>)
