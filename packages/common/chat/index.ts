export type ChatRole = "human" | "ai"; // 角色 human: 用户 ai: 助手
export type ChatRoleType = string; // Default role or a persisted custom agent ID
export type ChatMessageType = "reasoning" | "chat"; // 消息类型 reasoning: 推理消息 chat: 普通消息

//历史记录所返回的对象
export type ChatMessage = {
  role: ChatRole; // 角色 human: 人类 ai: 机器人
  reasoning?: string; //深度思考所返回的内容
  content: string; // 内容
  type: ChatMessageType; // 消息类型
};

//历史记录
export type ChatMessageList = ChatMessage[];

//左侧列表所返回的对象
export type ChatMode = {
  name: string;
  icon: string;
  prompt: string;
  isDefault: boolean;
  label: string; // 标签
  id: string; // id
  role: ChatRoleType; // 角色
};

//左侧列表所返回的对象列表
export type ChatModeList = ChatMode[]; //返回角色列表

//发送消息所需要的对象
export type ChatDto = {
  deepThink: boolean; // 是否推理
  webSearch: boolean; // 是否搜索网络
  role: ChatRoleType; // 角色
  content: string; // 内容
  userId: string; // 用户id
};

export type ChatAgentInput = { name: string; icon: string; prompt: string };
