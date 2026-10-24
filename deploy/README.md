# 独立环境部署

公开版本不包含已运行站点的服务器地址、SSH 凭据、生产数据或部署 Secrets。以下流程面向你自己的服务器，默认路径 `/opt/english-ai/deploy`，站点前缀 `/english/`。

## 准备配置

1. 将 `server/.env.example` 复制为 `server/.env`，填写自己的模型、SMTP、沙箱支付等配置。
2. 在仓库根目录运行 `node deploy/prepare-env.mjs`。脚本创建随机数据库和 MinIO 密码，并将本地后端配置复制到被 Git 忽略的 `deploy/runtime.env`，已有文件不覆盖。
3. 编辑 `deploy/.env`，将 `PUBLIC_BASE_URL` 设置为自己的公网域名（例如 `https://example.com`），添加 `WEB_BASE=/english/`。生成脚本默认的 localhost 地址仅供本地启动，支付宝服务器无法访问它。
4. 在服务器安装 Docker Compose，准备宿主 Nginx 和自己的 HTTPS 域名。参考 `host-locations.conf` 配置反向代理。

`deploy/.env.example` 也可作为手动配置模板，其中的密码占位值必须替换。不要将环境文件、私钥、备份、头像或用户数据提交到仓库。

## 首次启动

在已配置好环境的服务器仓库根目录执行：

```bash
BUILD_IMAGES=1 bash deploy/start.sh
```

Compose 启动 PostgreSQL、Redis、MinIO、业务 API、AI API 和 Web。数据库迁移创建空表，不导入真实数据。全新数据库可以按根 README 初始化演示课程；完整词库需自行导入有权使用的数据。

前端默认只绑定 `127.0.0.1:18082`；宿主 Nginx 需代理 `/english/`、`/api/v1/`、`/ai/v1/`、`/socket.io/` 和 `/storage/`。若使用站点根路径，请改用 `WEB_BASE=/` 并相应调整 Nginx。

## GitHub Actions 手动更新

公开仓库不继承任何原仓库的 Secrets。只有为自己的服务器配置以下仓库 Secrets 后，手动部署工作流才可运行：

- `DEPLOY_HOST`：自己的服务器地址。
- `DEPLOY_USER`：部署用 SSH 用户。
- `DEPLOY_SSH_KEY`：专用 SSH 私钥。
- `DEPLOY_KNOWN_HOSTS`：核验后的服务器 SSH 主机公钥记录。

推送 `master` 后，在 **Actions → Deploy English Camp to Aliyun → Run workflow** 中选择 `master`。推送不会自动部署。首次启动、服务器目录与 Nginx 配置需要提前完成；工作流使用 `/opt/english-ai/deploy` 中已有的运行环境文件。

发布前备份两个数据库，迁移前执行连接检查和超时重试。连接故障会重试；身份验证、结构迁移错误不会被无限重试。更新或健康检查失败时恢复旧应用配置及镜像，数据库迁移不自动回滚。迁移应保持向后兼容。

## 运行与备份

```bash
cd /opt/english-ai/deploy
sudo docker compose ps
sudo docker compose logs --tail=100 server ai
sudo docker compose restart server ai web
```

修改环境文件后使用 `docker compose up -d --force-recreate server ai`；仅 restart 不会重新读取 env_file。数据库和对象存储使用命名卷，不要对有用数据执行 `docker compose down -v`。

备份位于私有服务器 `deploy/backups/`。`install-prebuilt.sh`、`import-media.cjs` 是可选导入工具，仓库不附带备份或用户媒体。

## 沙箱支付

本地调试需要公网可达的内网穿透地址；公网服务器无需内网穿透。Compose 用 `PUBLIC_BASE_URL` 设置支付回调基础地址，后端追加 `/api/v1/pay/notify`。请配置同一沙箱应用的 APP_ID、公钥和私钥，并使用自己的沙箱买家账号。
