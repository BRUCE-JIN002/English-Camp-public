# BullMQ 队列任务与可靠性边界

队列将任务生产与执行解耦。Redis 保存队列状态，NestJS 的 InjectQueue 用于生产任务，Processor/WorkerHost 用于消费。当前主要使用 DIGEST_QUEUE，而不是把所有后端动作都做成异步任务。

## 三个概念不要混淆

| 概念 | 当前用途 | 不等于什么 |
| --- | --- | --- |
| Job Scheduler | 每天创建汇总任务 | 不保证精确到秒执行 |
| delayed job | 到用户设定时间后可被消费 | 不保证该时刻 SMTP 已完成 |
| jobId | 用户与日期维度去重 | 不保证邮件永远只发一次 |

调度器用稳定 ID upsert，避免每次应用启动都另建一个同义调度器。普通邮件任务的 jobId 依赖当天日期，已有任务的保留与移除会影响后续是否能加入同 ID 任务。

## 状态与异常

任务会经过等待、延迟、执行、完成或失败状态。Processor 的 Promise resolve 表示本次处理完成，抛错才会体现失败。MailService 已把 SMTP 异常向上传递，因此不能再照旧笔记写“发送失败 catch 后返回成功”。

每日调度任务设置 removeOnComplete 与 removeOnFail；邮件任务创建选项主要是 delay/jobId，没有显式 attempts/backoff。保留失败记录不等于自动重试，Redis AOF 也不等于整个业务恰好执行一次。

## 时区与重试设计

源码未配置 cron 的 tz，复习时应把“cron 表达式”和“它在哪个时区求值”分开。显式 tz 的写法可参考 [BullMQ 调度参数](https://docs.bullmq.io/guide/job-schedulers/repeat-options)，但仓库依赖是 BullMQ 5，升级或复制新版 API 前要核对锁文件与本地类型。

后续可添加有限次数的退避重试，并把失败原因分类。SMTP 超时可能发生在对方已接受之后，简单重试会重复投递；业务发送记录与 provider 标识比只设置 attempts 更重要。

## 排障顺序

先看调度器是否存在、下一次时间是否正确，再看用户任务是否入队、delay 是否符合业务日期，然后看 Worker 和邮件异常。队列没有任务时排查生产端，任务一直 waiting 时排查消费者，failed 时排查处理错误。

练习为“邮件发送抛错”写测试，确认任务不会被静默完成；为“账号注销时任务 active”验证拒绝注销而非强删运行中的任务。

## 源码定位

- [server/apps/ai/src/digest/digest.queue.ts](<../server/apps/ai/src/digest/digest.queue.ts>)
- [server/apps/ai/src/digest/digest.module.ts](<../server/apps/ai/src/digest/digest.module.ts>)
- [server/apps/ai/src/digest/digest.processor.ts](<../server/apps/ai/src/digest/digest.processor.ts>)
- [server/libs/shared/src/shared.module.ts](<../server/libs/shared/src/shared.module.ts>)
- [server/libs/shared/src/mail/mail.service.spec.ts](<../server/libs/shared/src/mail/mail.service.spec.ts>)
