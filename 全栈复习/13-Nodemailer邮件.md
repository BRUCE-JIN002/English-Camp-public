# Nodemailer 发送与失败传播

邮件模块把 SMTP 细节封装在 MailService，日报 Worker 只关心“向谁发送什么”和“是否失败”。

## 配置与发送

onModuleInit 创建 transporter，读取 EMAIL_HOST、EMAIL_PORT、EMAIL_USE_SSL、EMAIL_USER、EMAIL_PASSWORD。当前 secure 由数字配置转换为布尔值，不能把字符串 true 当成同等配置方式；端口和 TLS 选项需与邮件服务匹配。

连接和 greeting 超时均为 10 秒，socketTimeout 为 15 秒。sendEmail 参数名叫 text，实际放入 sendMail 的 html 字段。返回 true 前会 await sendMail，SMTP 抛错会传给 BullMQ。

transporter 创建成功只表示配置对象建好，不表示已经通过 SMTP 登录或投递验证。SMTP 接受邮件也不等于用户收件箱已经展示，仍可能遇到退信或垃圾邮件过滤。

## 为什么异常必须抛出

如果发送失败后只记录日志并正常返回，Worker 会把任务视为完成，后续无法区分真正成功与静默失败。当前实现保留失败传播，相关测试验证这一行为；但是任务是否自动重试取决于 BullMQ 任务选项。

## 内容和数据边界

摘要工具仅 select 所需用户字段，不应把完整用户对象送给模型。marked 转 HTML 并不自动等于内容净化；提醒模板插入 displayName 时也应考虑转义。邮件链接当前模板仍使用 localhost，需要替换为配置化公开站点地址后才能用于部署环境。

## 排障练习

依次区分 DNS/连接失败、TLS 不匹配、凭证失败、收件人拒收和已接受但未到箱。日志记录错误类别和任务 ID，避免输出密码或完整敏感正文。用 Mock SMTP 失败验证 Worker 失败路径，再用受控测试邮箱验证真实投递。

## 源码定位

- [server/libs/shared/src/mail/mail.service.ts](<../server/libs/shared/src/mail/mail.service.ts>)
- [server/libs/shared/src/mail/mail.service.spec.ts](<../server/libs/shared/src/mail/mail.service.spec.ts>)
- [server/apps/ai/src/digest/digest.processor.ts](<../server/apps/ai/src/digest/digest.processor.ts>)
- [server/apps/ai/src/digest/digest.service.ts](<../server/apps/ai/src/digest/digest.service.ts>)
