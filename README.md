# English Camp · 你的快乐英语营地

English Camp 是一个面向英语学习场景的全栈应用，将 AI 对话、词汇学习、课程、学习记录和邮件摘要放在同一个平台中。前端使用 Vue 3，后端使用 NestJS，AI 能力通过 DeepSeek 与 LangChain 接入。

[部署说明](deploy/README.md) · [第三方资源说明](THIRD_PARTY_NOTICES.md) · [全栈复习与面试笔记](全栈复习/README.md)

这是独立的公开源码版本，使用全新的提交历史，不包含原站点的账号、订单、聊天记录、词库备份、头像、凭据或生产配置。

> 本项目用于学习与演示，本地和线上均使用支付宝沙箱支付。请配置自己的服务与测试账号。

## 功能

| 模块 | 已实现能力 |
| --- | --- |
| AI 对话 | 多角色对话、自定义 Agent、普通与深度思考模式、联网搜索、流式回复、会话历史 |
| 词汇学习 | 词库查询、释义与发音、学习记录、已学单词复习 |
| 课程 | 课程列表、封面展示、沙箱购买、已购课程访问 |
| 个人中心 | 注册登录、个人资料、头像上传、学习统计、每日打卡 |
| 学习摘要 | 根据学习情况生成 AI 摘要，通过 BullMQ 调度并使用 SMTP 发送邮件 |
| 账户注销 | 二次确认后删除关联的用户业务数据、聊天状态和摘要任务，并退出登录 |
| 访问统计 | 自研埋点包采集访问和性能指标；未登录、退出或注销后停止上报 |
| 界面适配 | 桌面和移动端布局、主题切换、动画效果、缺失头像图标回退 |

语音输入依赖浏览器的语音识别能力；不支持的浏览器隐藏相关入口，文字对话仍可使用。

## 技术栈与服务

| 层级 | 技术 | 作用 |
| --- | --- | --- |
| 前端 | Vue 3、TypeScript、Vite、Vue Router | 页面、路由和构建 |
| 状态与 UI | Pinia、Element Plus、Tailwind CSS | 状态管理、组件和样式 |
| 通信与展示 | Axios、fetch-event-source、Socket.IO、marked | API、流式响应、实时通知和 Markdown |
| 动画 | GSAP、Three.js、canvas-confetti | 页面动画、3D 展示和庆祝效果 |
| 后端 | NestJS、JWT | 业务接口与登录鉴权 |
| AI | LangChain、DeepSeek、PostgreSQL checkpoint | 模型调用、Agent 和会话状态持久化 |
| 数据库 | PostgreSQL 18、Prisma 7、pg | 用户、课程、订单、学习记录与聊天数据 |
| 任务队列 | Redis 7.4、BullMQ | 延迟任务和定时任务 |
| 对象存储 | MinIO | 头像、课程封面等文件 |
| 外部接口 | 博查搜索、支付宝沙箱、SMTP | 联网搜索、模拟支付和邮件 |
| 埋点 | FingerprintJS、ua-parser-js、web-vitals | 访客识别、设备信息和性能指标 |
| 测试与部署 | Jest、Supertest、Docker Compose、Nginx、GitHub Actions | 验证、打包、代理和发布 |

依赖版本以各工作区的 `package.json` 和根目录 `pnpm-lock.yaml` 为准。

## 项目结构

项目使用 **pnpm workspace Monorepo**：一个仓库管理前端、后端、埋点 SDK 和共享代码，工作区通过 `workspace:*` 引用本地包。

```text
.
├── apps/
│   ├── web/                  # @en/web：Vue 前端
│   └── tracker/              # @en/tracker：埋点 SDK
├── server/                   # @en/server：NestJS 工作区
│   ├── apps/
│   │   ├── server/           # 业务 API
│   │   └── ai/               # AI API 与摘要任务
│   ├── libs/shared/          # 数据库、鉴权、存储、支付、邮件等共享模块
│   ├── prisma/               # 数据模型、迁移、课程种子数据和封面
│   └── prisma.config.ts
├── packages/
│   ├── common/               # @en/common：共享类型
│   └── config/               # @en/config：共享配置与应用端口
├── deploy/                   # Docker、Nginx、发布脚本与部署文档
├── .github/workflows/        # GitHub Actions 手动发布流程
└── pnpm-workspace.yaml
```

业务 API 和 AI API 是同一个 `@en/server` 包中的两个 NestJS 应用，不存在独立的 `@en/ai` 工作区。

## 本地开发

### 1. 环境准备

建议与部署环境保持一致：**Node.js 24.13.1、pnpm 10.30.1**。同时准备可连接的 PostgreSQL、Redis 和 MinIO。

```bash
git clone https://github.com/BRUCE-JIN002/English-Camp-public.git
cd English-Camp-public
corepack enable
corepack prepare pnpm@10.30.1 --activate
pnpm install --frozen-lockfile
```

需要两个 PostgreSQL 数据库：

- `english`：业务数据，由 Prisma 迁移管理。
- `english_chat`：AI 会话 checkpoint，由 AI 服务初始化相关表。

数据库账号须具备对应数据库的连接和建表权限。以下基础服务端口为常见配置，实际值以本机服务为准：

| 服务 | 端口 |
| --- | --- |
| PostgreSQL | `5432`，已有实例使用其他端口时修改连接串 |
| Redis | `6379` |
| MinIO API | `9000` |
| MinIO 控制台 | 通常为 `9001`，取决于启动参数 |

`pnpm all` 只启动三个应用进程，**不会启动 PostgreSQL、Redis、MinIO 或内网穿透客户端**。

### 2. 配置环境变量

复制 `server/.env.example` 为 `server/.env`，根据实际服务填写下面的配置。示例中的占位值必须替换，支付宝密钥须来自同一套沙箱应用。

```dotenv
# PostgreSQL：先创建数据库和账号，密码中的特殊字符需要 URL 编码
DATABASE_URL=postgresql://english:YOUR_DB_PASSWORD@127.0.0.1:5432/english
AI_DATABASE_URL=postgresql://english:YOUR_DB_PASSWORD@127.0.0.1:5432/english_chat

# 登录令牌与任务队列
SECRET_KEY=REPLACE_WITH_A_LONG_RANDOM_SECRET
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
TZ=Asia/Shanghai
AI_INTERNAL_URL=http://127.0.0.1:3001

# MinIO
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_USE_SSL=0
MINIO_ACCESS_KEY=YOUR_MINIO_ACCESS_KEY
MINIO_SECRET_KEY=YOUR_MINIO_SECRET_KEY
MINIO_BUCKET=avatar

# AI：模型名称填写账号可用的模型 ID
DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY
DEEPSEEK_API_MODEL=YOUR_CHAT_MODEL_ID
DEEPSEEK_REASONER_API_MODEL=YOUR_REASONER_MODEL_ID

# 联网搜索：使用该功能时配置
BOCHA_SEARCH_URL=YOUR_BOCHA_SEARCH_API_URL
BOCHA_API_KEY=YOUR_BOCHA_API_KEY

# 邮件：端口与 SSL 设置须匹配邮件服务商配置
EMAIL_HOST=YOUR_SMTP_HOST
EMAIL_PORT=465
EMAIL_USE_SSL=1
EMAIL_USER=YOUR_SENDER_ADDRESS
EMAIL_PASSWORD=YOUR_SMTP_AUTHORIZATION_CODE

# 仅支付宝沙箱
ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do
ALIPAY_APP_ID=YOUR_SANDBOX_APP_ID
ALIPAY_PRIVATE_KEY="YOUR_SANDBOX_PRIVATE_KEY"
ALIPAY_PUBLIC_KEY="YOUR_SANDBOX_ALIPAY_PUBLIC_KEY"
ALIPAY_NOTIFY_URL=https://YOUR_PUBLIC_CALLBACK_HOST
ALIPAY_SELLER_ID=
```

环境文件和私钥不应提交到 Git。前端不需要模型、SMTP 或支付密钥。

开发模式默认直接访问 `http://127.0.0.1:9000` 获取媒体，使用 `http://localhost:3000` 连接 Socket.IO。如果要在手机上访问本机开发服务，可在 `apps/web/.env` 中设置手机可访问的局域网地址，然后重启 Vite：

```dotenv
VITE_MINIO_ENDPOINT=http://YOUR_LAN_IP:9000
VITE_SOCKET_URL=http://YOUR_LAN_IP:3000
```

此时还需让 Vite 和相关服务监听局域网可访问的接口；手机上的 `localhost` 指向手机自身。

### 3. 初始化数据库与本地包

在基础服务可用、环境变量配置完成后执行：

```bash
pnpm --filter @en/server exec prisma generate
pnpm --filter @en/server exec prisma migrate deploy
pnpm --filter @en/tracker build
```

如果是**全新的空业务数据库**，可初始化 8 门演示课程并上传随仓库提供的课程封面：

```bash
pnpm --filter @en/server exec prisma db seed
```

种子脚本会写入课程并上传图片到 MinIO 的 `course` 桶，**不是幂等脚本，不要对已有数据反复执行**。它不会导入完整词库；词库数据需要另外准备或从有权使用的数据源导入。课程价格属于沙箱演示数据。

### 4. 启动应用

```bash
pnpm all
```

也可以在不同终端单独启动：

```bash
pnpm web       # Vue 前端
pnpm server    # 业务 API
pnpm ai        # AI API 与任务处理
```

| 应用 | 默认地址 |
| --- | --- |
| Web | `http://localhost:8080` |
| 业务 API | `http://localhost:3000/api/v1` |
| AI API | `http://localhost:3001/ai/v1` |

应用端口定义在 `packages/config/index.ts`。如果 Vite 的默认端口被占用，以终端实际输出的地址为准。前端开发代理将 `/api` 和 `/ai` 请求转发到两个后端服务。

## 支付宝沙箱支付

本项目明确使用沙箱，代码拒绝正式支付宝网关。

- **本地调试**：启动内网穿透，将公网入口转发到业务 API，或转发到能够代理 `/api` 的前端开发服务。
- **线上部署**：直接使用服务器公网地址或域名，无需内网穿透。
- `ALIPAY_NOTIFY_URL` 填写公网基础地址，程序会追加 `/api/v1/pay/notify`。
- Compose 部署时，回调基础地址由 `deploy/.env` 中的 `PUBLIC_BASE_URL` 覆盖；仅修改 `runtime.env` 中的同名回调配置不会覆盖 Compose 的设置。
- 支付结果经过服务端验签、订单及金额校验后处理；前端通过实时通知与状态查询更新购买结果。

沙箱买家账号及支付密码请在自己的支付宝沙箱控制台获取，不写入仓库。支付完成但页面未更新时，检查回调可达性、后端日志及订单查询结果。

## 构建与验证

在仓库根目录执行：

```bash
# 前端：先构建工作区依赖，再执行类型检查与生产构建
pnpm --filter @en/tracker build
pnpm --filter @en/web build

# 两个后端应用
pnpm --filter @en/server build
pnpm --filter @en/server exec nest build ai

# 后端单元与回归测试
pnpm --filter @en/server exec jest --runInBand
```

集成测试需要匹配的本地数据库、环境变量及正在运行的服务，会创建测试数据，应在开发环境运行：

```bash
pnpm --filter @en/server test:integration:agents
pnpm --filter @en/server test:integration:learned
```

测试覆盖支付通知、账户注销、用户鉴权、AI 会话、埋点与邮件等逻辑；测试通过不等于外部模型、SMTP 或支付宝服务一定可用，接入后仍需验证实际链路。

## GitHub Actions 手动部署

仓库提供的手动发布模板面向已经完成初始化的服务器，**推送代码不会自动部署**。

1. 将修改提交并推送到 `master`。
2. 打开仓库 **Actions → Deploy English Camp to Aliyun**。
3. 点击 **Run workflow**，选择 `master` 并运行。
4. 工作流完成构建、测试、镜像上传、数据库备份与迁移，然后更新应用容器并检查服务。
5. 发布成功后访问自己的站点，或查看 `/english/release.json` 确认版本。

仓库需要配置以下 Actions Secrets：

| Secret | 内容 |
| --- | --- |
| `DEPLOY_HOST` | 服务器地址 |
| `DEPLOY_USER` | SSH 部署用户 |
| `DEPLOY_SSH_KEY` | 专用部署私钥 |
| `DEPLOY_KNOWN_HOSTS` | 已验证的服务器 SSH 主机公钥记录 |

线上由 Docker Compose 管理 Web、业务 API、AI API、PostgreSQL、Redis 和 MinIO；前端以 `/english/` 为基础路径构建，Nginx 代理 API、Socket.IO 和 `/storage/` 媒体请求。

发布前会备份两个数据库。切换或健康检查失败时，脚本恢复旧应用配置及镜像；**数据库迁移不会自动回滚**，迁移应保持向后兼容。日常更新不需要重新导入课程或词库。

首次服务器准备、环境文件、持久化存储、备份位置和运维命令见 [deploy/README.md](deploy/README.md)。不要使用 `docker compose down -v` 清理正在使用的数据库或对象存储卷。

## 常见问题

- **课程封面和头像同时消失**：先确认 MinIO 服务、数据卷及 `course` / `avatar` 桶中的文件；`NoSuchKey` 表示对应对象不存在。数据库中的图片路径不会自动恢复图片文件。
- **AI 页面可打开但没有回复**：检查 AI 服务、模型配置、会话数据库和 `/ai/v1` 代理；不支持语音识别的浏览器仍可使用文字对话。
- **手机开发预览没有图片或通知**：检查 `VITE_MINIO_ENDPOINT` 和 `VITE_SOCKET_URL`，避免使用手机无法访问的本机回环地址。
- **定时邮件没有收到**：同时检查 AI 服务、Redis 队列、用户邮箱与摘要设置、服务器时区，以及 SMTP 连接和发送结果。任务接口成功不代表邮件已经送达。
- **部署后仍显示旧页面**：检查 Actions 是否运行成功、`release.json` 是否为目标版本，并刷新浏览器缓存。

## 公开版本与资源授权

此仓库不会同步原私有仓库的 Git 历史或生产环境 Secrets。提交更新前运行 `node scripts/check-public.mjs`，不要加入运行环境文件、数据库备份、个人媒体或真实账号信息。

源代码当前未另行指定统一的开源许可证；公开可见不代表授予任意再分发或商用许可。随附第三方模型保留原始许可证与署名，其中注册页模型包含非商业使用限制，详见 [第三方资源说明](THIRD_PARTY_NOTICES.md) · [全栈复习与面试笔记](全栈复习/README.md)。
