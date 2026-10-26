# 前端埋点 SDK 与身份切换

tracker 是 Vite library 项目，封装 UV、PV、点击、性能和错误上报。它与业务页面通过配置连接，web 从构建产物引用它。

## 当前初始化流程

构造时一次安装监听器，所有监听器在上报时通过 visitor getter 取当前身份。refreshVisitor 每次增加 revision，立即清空 visitorId，并 abort 上一次注册请求。没有 userId 就停止；有账号才请求指纹并注册。

anonymousId 为指纹加账户 ID，服务器返回 visitorId 后才恢复事件上报并补报 PV。迟到的注册结果若 revision 不符会被丢弃。因此当前没有“登出状态持续采集匿名 PV，再绑定账号”的行为。

## 事件采集

PV 监听初次登记、hashchange、popstate，并包装 history.pushState/replaceState。点击模块主要关注按钮及其子元素；错误模块处理 error 和 unhandledrejection，并兼容空值、循环对象、BigInt 等异常内容。

性能模块读取 paint entries，等待 LCP observer，再注册 INP/CLS 和页面隐藏上报。这里有局限：首次取得 LCP 后就 disconnect，不能据此声称拿到了最终 LCP；若该观察不触发，后续注册也可能无法完成。FP/FCP 过早读取可能缺失，0 不应被解释成真实性能为零。

## 上报语义

PV 等使用 sendBeacon，UV 注册用 fetch，因为需要响应中的 ID。sendBeacon 返回 true 只表示浏览器成功排队，不能证明服务器已收到或入库；当前 report 也没有处理返回 false、持久化重试或去重确认。因此原笔记的“保证数据不丢失”必须删除。[MDN Beacon API](https://developer.mozilla.org/en-US/docs/Web/API/Beacon_API)

fingerprint 是客户端身份线索，不是可信用户认证。采集内容还需限制文本长度与敏感信息，避免把按钮中的个人信息直接写入日志。

## 构建和验证

```bash
pnpm --filter @en/tracker build
```

修改 SDK 后先重建，再启动或构建 web。现有 tracker-client 测试覆盖登出停止、撤销注册、迟到响应和异常 reason 序列化；这些不等于已验证所有浏览器性能指标。

复习题：为何只有 abort 不够？因为已经完成或不可取消的异步步骤仍可能返回；revision 是防止旧结果重新恢复访客身份的第二道检查。

## 源码定位

- [apps/tracker/index.ts](<../apps/tracker/index.ts>)
- [apps/tracker/src/uv/index.ts](<../apps/tracker/src/uv/index.ts>)
- [apps/tracker/src/report/index.ts](<../apps/tracker/src/report/index.ts>)
- [apps/tracker/src/performance/index.ts](<../apps/tracker/src/performance/index.ts>)
- [apps/tracker/src/error/index.ts](<../apps/tracker/src/error/index.ts>)
- [apps/tracker/vite.config.ts](<../apps/tracker/vite.config.ts>)
- [server/apps/server/src/tracker/tracker-client.spec.ts](<../server/apps/server/src/tracker/tracker-client.spec.ts>)
