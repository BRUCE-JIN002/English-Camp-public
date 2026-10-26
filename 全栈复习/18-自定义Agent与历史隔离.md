# 自定义 Agent 与用户历史隔离

Agent 管理让用户保存名称、图标、人物设定和强调色。默认角色来自静态配置，用户修改保存在 ChatAgent，列表读取时合并两者。

## 默认值与覆盖值

list 先取该 userId 的所有 ChatAgent，再按 role 建 Map。默认角色若没有覆盖就使用默认值；有覆盖则替换；deleted 为 true 则隐藏。剩余非默认且未删除的角色作为自定义角色追加。

为什么删除默认角色还要写一行 deleted 记录？如果直接删除覆盖行，下次列表合并会重新显示默认角色。保留删除标记才能表达用户明确隐藏这个默认项的意愿。

自定义 role 使用 `custom-UUID`，复合唯一键 userId/role 限制同一用户的重复定义。名称、图标、prompt 长度限制分别为 30、16、6000，强调色必须在共享配色表内。前后端使用同一枚举来源减少漂移，服务端仍再次验证。

## 归属校验与聊天历史

PromptController 依赖登录身份，resolve 从当前用户可用列表中查角色，删除或他人角色不能直接拿来聊天。ChatService 每次回复读取最新 prompt，同时继续使用 userId-role 的历史键。

修改 prompt 不会自动清空历史；删除 Agent 只隐藏角色，当前 remove 没有删除对应 checkpoint。账号注销另有批量历史清理逻辑。

前端最后选中角色按 userId 放在内存 Map：离开聊天页再回来可以恢复，浏览器刷新后重置。它既不是数据库偏好，也不是 localStorage 永久记忆。

## 验证练习

验证创建后刷新仍存在、修改默认角色只影响当前账户、删除默认角色刷新不复活、非法颜色被拒绝、他人 role 不可访问、修改 prompt 后下一轮使用新设定。可从 chat.service.spec 与 agents.integration 入手；集成测试依赖环境，运行前阅读脚本。

## 源码定位

- [server/apps/ai/src/prompt/prompt.service.ts](<../server/apps/ai/src/prompt/prompt.service.ts>)
- [server/apps/ai/src/prompt/prompt.controller.ts](<../server/apps/ai/src/prompt/prompt.controller.ts>)
- [packages/common/chat/colors.js](<../packages/common/chat/colors.js>)
- [server/prisma/schema.prisma](<../server/prisma/schema.prisma>)
- [apps/web/src/stores/chatSelection.ts](<../apps/web/src/stores/chatSelection.ts>)
- [server/apps/ai/test/agents.integration.ts](<../server/apps/ai/test/agents.integration.ts>)
