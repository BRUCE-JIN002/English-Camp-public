# MinIO 文件路径与对象生命周期

MinIO 保存头像、媒体和发音缓存；数据库通常保存对象路径。要分清容器内部连接地址、浏览器可访问地址和数据库持久化路径。

## 头像上传链路

浏览器用 FormData 的 file 字段提交 → FileInterceptor 解析文件 → UserService 检查存在及 5MB 大小 → putObject 写入桶 → 返回 previewUrl 和 databaseUrl。

databaseUrl 形如 `/桶名/对象名`，不绑定服务器地址；previewUrl 由后端 MinIO 主机和端口拼接，在 Docker 内部可能无法从浏览器访问。前端通过 uploadUrl 与持久化路径组合，生产默认 `/storage`，Nginx 转发到 MinIO。

文件名当前是时间戳加原始文件名，不能声称严格防碰撞。Service 中的 5MB 检查发生在解析文件后，也不是 Multer 请求阶段的内存限制；当前 Controller 没有为上传接口添加 AuthGuard。

## 启动初始化

MinioService 最多尝试 8 次，退避从 1 秒增长并封顶 30 秒。桶不存在时创建并设置公开 GetObject 策略；桶已存在时不会重新校验或修复策略。重试耗尽后没有显式 throw，因此“进程启动成功”不证明存储初始化成功。

公开桶适合公开媒体，不适合把私密数据混放进去。Nginx 的 `/storage/` 只允许 GET/HEAD，管理接口仍应留在内部网络。

## 发音缓存复用

pronunciation 使用同一 MinioService，但对象键是由单词、音色、速度、编码、版本计算的 SHA-256。缓存优先能降低重复合成调用；缓存服务不可用时直接报错，不绕过缓存无限调用付费 TTS。

## 验证和改进

验证上传应同时看对象存在、浏览器 URL 能读取、Content-Type 正确和页面能显示。接口返回成功但 URL 是内部域名，仍然不算完成。

可以增加鉴权、Multer limits、文件真实类型校验、随机对象名及旧头像回收。账号注销目前没有删除 MinIO 头像，数据库外键不会帮忙回收对象文件。

## 源码定位

- [server/libs/shared/src/minio/minio.service.ts](<../server/libs/shared/src/minio/minio.service.ts>)
- [server/apps/server/src/user/user.controller.ts](<../server/apps/server/src/user/user.controller.ts>)
- [server/apps/server/src/user/user.service.ts](<../server/apps/server/src/user/user.service.ts>)
- [apps/web/src/apis/index.ts](<../apps/web/src/apis/index.ts>)
- [deploy/nginx.docker.conf](<../deploy/nginx.docker.conf>)
