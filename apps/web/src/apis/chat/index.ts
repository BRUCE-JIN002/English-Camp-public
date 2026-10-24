import type {
  ChatMessageList,
  ChatAgentInput,
  ChatMode,
  ChatModeList,
  ChatRoleType,
} from "@en/common/chat";
import { aiApi, type Response } from "..";

// 获取聊天模式列表
export const getChatMode = (): Promise<Response<ChatModeList>> => {
  return aiApi.get("/prompt/list") as Promise<Response<ChatModeList>>;
};

// 获取聊天记录
export const getChatHistory = (
  userId: string,
  role: ChatRoleType,
): Promise<Response<ChatMessageList>> => {
  return aiApi.get(`/chat/history?userId=${userId}&role=${role}`) as Promise<
    Response<ChatMessageList>
  >;
};

export const createChatAgent = (input: ChatAgentInput): Promise<Response<ChatMode>> => aiApi.post('/prompt', input);
export const updateChatAgent = (role: string, input: ChatAgentInput): Promise<Response<ChatMode>> => aiApi.patch(`/prompt/${encodeURIComponent(role)}`, input);
export const deleteChatAgent = (role: string): Promise<Response<null>> => aiApi.delete(`/prompt/${encodeURIComponent(role)}`);
