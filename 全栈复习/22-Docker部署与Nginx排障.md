# Docker 部署与 Nginx 子路径排障

部署把代码、环境、数据库结构、媒体和路由连接成可访问服务。本文描述仓库配置与验证方法，不代表当前远端已经通过这些检查。

## 构建和启动顺序

Dockerfile 使用 Node 24 构建，先安装锁文件依赖、生成 Prisma 客户端、构建两个 Nest 应用，再构建 tracker 和 web。web 使用构建参数 WEB_BASE，静态产物交给 Nginx 镜像；后端目标复用构建阶段。

Compose 包含 postgres、redis、minio、migrate、server、ai、web。基础设施 healthcheck 通过后迁移，迁移成功后才启动业务服务。PostgreSQL 和聊天数据使用不同数据库配置；命名 volume 保存持久数据。不要把删除容器与删除 volume 混为一谈。

web 默认绑定回环地址 18082，由宿主反代转发。与其他站点共存时，新增路由前要确认 API、Socket 和 storage 前缀没有冲突。

## 子路径映射

| 浏览器请求 | 处理方式 |
| --- | --- |
| /english/ 与其静态资源 | 宿主去掉 /english/ 前缀转给 web |
| /api/v1/... | 保留路径，经 web 转 server |
| /ai/v1/... | 保留路径，经 web 转 ai |
| /socket.io/... | WebSocket Upgrade 代理 |
| /storage/... | web 去掉 storage 前缀转 MinIO |

Router 使用 BASE_URL，ModelViewer 也使用基址拼模型路径。API 的根路径是当前部署约定，不能全局替换为页面基址。History 路由刷新需要 try_files 回落到 index.html；但资源不存在时误回落 HTML 会表现为 200，却仍然无法解析模型或脚本。

SSE 要求宿主与容器两层代理都关闭 buffering/cache，并设置合适读超时。若模型流正常但浏览器最后一次性显示全文，先沿这条链排查。

## 数据库迁移与重试

Compose 的 migrate 服务直接执行 prisma migrate deploy。仓库另有 migrate-with-retry 脚本：先认证连接两个数据库并 SELECT 1，只对指定连接瞬态错误进行有限重试；schema 错误、进程被杀或超时不会盲目重跑。不能写成所有部署入口都自动走这个脚本。

数据迁移、种子词库和媒体导入是不同步骤。镜像构建成功不意味着课程内容与模型文件已经可用。

## 验收顺序

先看容器与依赖健康，再看迁移和必要数据；请求首页、API、模型文件时检查状态码及 Content-Type；登录后实际操作一个页面，验证 SSE 增量和音频播放。涉及支付和邮件需受控外部验收。

发布时记录镜像或 commit 标识，回滚先评估数据库结构兼容性。不能只回滚容器而忽略已经执行的破坏性迁移。日常查看状态可用以下命令，具体环境文件按 deploy/README 配置：

```bash
docker compose -f deploy/compose.yaml ps
docker compose -f deploy/compose.yaml logs --tail=100 server ai web
```

## 源码定位

- [deploy/Dockerfile](<../deploy/Dockerfile>)
- [deploy/compose.yaml](<../deploy/compose.yaml>)
- [deploy/host-locations.conf](<../deploy/host-locations.conf>)
- [deploy/nginx.docker.conf](<../deploy/nginx.docker.conf>)
- [deploy/migrate-with-retry.cjs](<../deploy/migrate-with-retry.cjs>)
- [deploy/README.md](<../deploy/README.md>)
- [apps/web/src/components/Login/ModelViewer.vue](<../apps/web/src/components/Login/ModelViewer.vue>)
