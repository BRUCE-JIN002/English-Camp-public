# 支付宝 SDK 接入与回调核对

这一篇关注协议接入细节，课程权益和事务闭环见第 04 篇。支付宝返回的通知必须经过签名与本地订单信息核对，不能只看 trade_status。

## 下单参数来源

shared PayService 封装 SDK 配置。业务 create 读取数据库课程价格，调用 `alipay.trade.page.pay` 的 pageExecute 生成 URL，并传入 out_trade_no、total_amount、subject、body、product_code 和 timeout_express。

总金额由 Decimal.toFixed(2) 转成字符串。notify_url 由 ALIPAY_NOTIFY_URL 基址拼上 `/api/v1/pay/notify`，配置值应是可被支付平台访问的站点基址，不应再次包含完整通知路径。前端倒计时用于体验，真正付款状态以平台结果为准。

## notify 的检查顺序

1. checkNotifySignV2 验签。
2. app_id 必须匹配；若配置 sellerId 则核对卖方。
3. out_trade_no 必须对应本地订单，total_amount 格式和 Decimal 金额必须一致。
4. 仅 TRADE_SUCCESS、TRADE_FINISHED 进入结算；其他有效通知返回 success 但不授予权益。
5. 检查 trade_no、课程绑定和付款时间。新订单从本地 body 取 courseId；兼容旧数据时才尝试已验签的回调 body。
6. 将 gmt_payment 按 +08:00 解析，再执行幂等 settle。

Controller 显式返回 HTTP 200 的纯文本 success 或 failure。这个端点不使用普通 JSON 统一包装，否则支付平台可能无法正确确认通知。

## 主动查单

`alipay.trade.query` 开启 validateSign，核对返回订单号、交易号与金额。订单不存在可继续查其他候选；服务异常保持“未确认”，不会盲目开通课程。主动查询和异步通知复用同一个 settle，避免两条通路结算规则分叉。

## 能证明与不能证明的内容

现有单元测试覆盖无效签名、待支付状态、重复通知、提交后再通知、漏回调补偿和查单失败，也用真实 SDK 验证金额序列化。Mock 测试不能证明真实平台已到账，也不能替代沙箱端到端验收。

后续可补 sellerId 必填策略、通知审计、订单复用、退款与定时对账。当前未实现这些完整能力，简历不要写“完整支付平台”。

## 源码定位

- [server/libs/shared/src/pay/pay.service.ts](<../server/libs/shared/src/pay/pay.service.ts>)
- [server/apps/server/src/pay/pay.service.ts](<../server/apps/server/src/pay/pay.service.ts>)
- [server/apps/server/src/pay/pay.controller.ts](<../server/apps/server/src/pay/pay.controller.ts>)
- [server/apps/server/src/pay/pay.service.spec.ts](<../server/apps/server/src/pay/pay.service.spec.ts>)
