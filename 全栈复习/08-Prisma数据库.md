# Prisma 数据模型约束与事务

Prisma 提供类型化查询和迁移管理，但业务一致性仍取决于约束、事务边界与隔离级别。当前使用 Prisma 7、PostgreSQL adapter，生成客户端输出到 shared 下；不要直接修改生成文件。

## 13 个业务模型

| 分组 | 模型 | 重要约束或关联 |
| --- | --- | --- |
| 用户 | User | phone、email 唯一 |
| 学习 | WordBook、WordBookRecord、CheckIn | userId/wordId、userId/date 唯一 |
| 课程支付 | Course、CourseRecord、PaymentRecord | userId/courseId 唯一、outTradeNo 唯一 |
| 埋点 | Visitor、PageView、TrackEvent、PerformanceEntry、ErrorEntry | anonymousId 唯一，事件关联访客 |
| Agent | ChatAgent | userId/role 唯一，deleted 标记 |

支付状态是 TradeStatus 枚举。价格和支付金额使用 Decimal；不要通过浮点加减处理结算。当前课程列表用 Number(...).toFixed(2) 仅用于展示，支付下单从 Decimal.toFixed(2) 生成金额，回调使用 Decimal.equals 比较。

用户的学习、支付、课程、打卡、Agent 与访客关系配置了级联删除。聊天 checkpoint 不属于这份 schema，需要独立清理；MinIO 对象也不会被外键级联删除。

## 约束解决什么问题

唯一约束是并发写入时的最终规则，先查询存在性不能替代它。索引用于特定过滤、排序或关联场景，数量越多写入维护成本越高。性能指标模型的多列索引不能自动优化所有指标组合，应使用实际查询的 EXPLAIN 判断。

支付 settle 使用交互式事务，将条件更新订单和 upsert 权益一起提交。学习保存目前分多次执行，是需要补事务的对照案例。

已掌握查询把 count/findMany 放在事务中，但 PostgreSQL 默认 Read Committed 下，两条语句可见的数据快照可能不同。确需一致快照时应明确隔离需求，评估 Repeatable Read 等方案；不是所有读操作都必须升级隔离级别。[PostgreSQL 隔离级别](https://www.postgresql.org/docs/current/transaction-iso.html)

## 开发与发布命令

```bash
# 项目根目录，读取 server 的配置
pnpm --filter @en/server exec prisma generate
pnpm --filter @en/server exec prisma migrate status
# 发布环境应用已经评审的迁移，会修改数据库
pnpm --filter @en/server exec prisma migrate deploy
```

generate 生成客户端，不会自动应用迁移；migrate deploy 应用已有迁移，不是导入课程和媒体。schema 增加字段后，还要确认迁移文件、客户端生成和运行环境版本一致。当前迁移包含 ChatAgent 与 accentColor。

## 复习练习

用支付与学习两个流程解释原子性；用 Visitor 被并发删除解释外键错误；用账号注销解释“单库事务无法覆盖 Redis 和另一个数据库”。

## 源码定位

- [server/prisma/schema.prisma](<../server/prisma/schema.prisma>)
- [server/prisma.config.ts](<../server/prisma.config.ts>)
- [server/libs/shared/src/prisma/prisma.service.ts](<../server/libs/shared/src/prisma/prisma.service.ts>)
- [server/prisma/migrations/20261025060000_agent_accent_color/migration.sql](<../server/prisma/migrations/20261025060000_agent_accent_color/migration.sql>)
