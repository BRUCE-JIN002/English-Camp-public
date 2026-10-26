# LangChain 模型工具与检查点

本项目中 LangChain 组织模型消息、Agent 执行与检查点；DeepSeek 提供文本生成；博查提供搜索内容。不要把这些不同职责统一叫作“训练了模型”。

## 两条 Agent 链路

| 场景 | 输入与上下文 | 工具 | 输出 |
| --- | --- | --- | --- |
| Chat 对话 | 用户问题、角色提示词、可选搜索内容、历史 | 当前未挂 tools | 消息流与检查点 |
| Digest 日报 | 指定用户与日报任务提示 | queryTool 查学习数据 | 一次性报告，再转 HTML |

Chat 工厂读取环境变量中的普通模型和 Reasoner 模型，配置 maxTokens 分别为 4396 和 23296。这是本项目请求配置，不能解释为模型上下文上限，也不证明所有参数都会产生预想效果。

PostgresSaver 负责保存与恢复线程状态，setup 初始化其所需结构。检查点与业务 Prisma 分开管理，因此新增用户关系迁移不会自动修改聊天历史表。

## 搜索增强与 RAG 的区别

当前流程是用问题调用博查，将标题、链接、摘要、站点等拼到系统提示中，再发给模型。源码没有文档切块、Embedding、向量检索或重排链路，不能在面试中讲成已实现向量 RAG。

网页和用户自定义提示都属于不可信内容。搜索结果拼到 systemPrompt 不会自动获得可信性；后续应分离指令与资料、限制内容长度并保留可核对引用。当前“返回网站名称”的提示也不保证每项事实正确。

## Tool 的权限边界

日报工具 schema 描述 userId，由模型参数传入并查询数据库。更稳健的方案是工具闭包绑定任务所有者，模型不能改变查询身份；不要仅靠“提示词要求过滤敏感信息”承担访问控制。

当前日报查询返回数据后，由 Agent 决定调用和生成。需要可重复、可审计的日报时，可以在应用层先查询确定性数据，再让模型只负责表述。

## 复习练习

说明 HumanMessage、systemPrompt、stream、invoke、thread_id 的职责；模拟模型失败验证日报降级；修改一个自定义 Agent 的 prompt，验证下一次回复读取新设定但线程键保持不变。

## 源码定位

- [server/apps/ai/src/llm/llm.config.ts](<../server/apps/ai/src/llm/llm.config.ts>)
- [server/apps/ai/src/chat/chat.service.ts](<../server/apps/ai/src/chat/chat.service.ts>)
- [server/apps/ai/src/digest/digest.service.ts](<../server/apps/ai/src/digest/digest.service.ts>)
- [server/apps/ai/src/chat/chat.service.spec.ts](<../server/apps/ai/src/chat/chat.service.spec.ts>)
