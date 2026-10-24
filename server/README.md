# English Camp 后端

此 NestJS 工作区包含两个应用：

- `server`：业务 API，默认端口 3000，前缀 `/api/v1`。
- `ai`：AI 对话、Agent、学习摘要和邮件任务，默认端口 3001，前缀 `/ai/v1`。

配置方法和完整启动流程见[根 README](../README.md)。复制 `.env.example` 为 `.env`，填写自己的配置，勿提交真实凭据。

在仓库根目录执行：

```bash
pnpm --filter @en/server exec prisma generate
pnpm --filter @en/server exec prisma migrate deploy
pnpm server
# 另一个终端
pnpm ai
```

构建与单元测试：

```bash
pnpm --filter @en/server build
pnpm --filter @en/server exec nest build ai
pnpm --filter @en/server exec jest --runInBand
```

PostgreSQL、Redis、MinIO 和所需外部服务须另外配置。单元测试不需要生产凭据；集成测试会创建数据，应使用独立开发环境。
