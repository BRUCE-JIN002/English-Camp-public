import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  createCheckPointer,
  createDeepSeek,
  createBochaSearch,
  createDeepSeekReasoner,
} from '../llm/llm.config';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { ChatRoleType, ChatDto } from '@en/common/chat/index';
import { createAgent } from 'langchain';
import { AIMessageChunk, HumanMessage } from '@langchain/core/messages';
import { PromptService } from '../prompt/prompt.service';
import { ResponseService } from '@libs/shared';
@Injectable()
export class ChatService implements OnModuleInit {
  private checkPointer: PostgresSaver;
  private responseService: ResponseService;

  constructor(responseService: ResponseService, private readonly prompts: PromptService) {
    this.responseService = responseService;
  }

  async onModuleInit() {
    // 初始化检查点
    this.checkPointer = await createCheckPointer();
  }

  async streamCompletion(createChatDto: ChatDto) {
    const promptObject = await this.prompts.resolve(createChatDto.userId, createChatDto.role);
    //拿到基础提示词
    let prompt = promptObject.prompt;
    //如果开启了联网搜索增强提示词
    if (createChatDto.webSearch) {
      const webSearchPrompt = await createBochaSearch(createChatDto.content);
      prompt += `请根据以下搜索结果回答问题：${webSearchPrompt}(并且返回你参考的网站名称)，用户问题：${createChatDto.content}`;
    }
    let model = createDeepSeek(); //默认是对话模型
    if (createChatDto.deepThink) {
      model = createDeepSeekReasoner(); //深度思考模型
    }
    const agent = createAgent({
      model: model,
      systemPrompt: prompt,
      checkpointer: this.checkPointer,
    });
    //2.组装消息格式
    const id = `${createChatDto.userId}-${createChatDto.role}`;
    const stream = (agent as any).stream(
      { messages: [new HumanMessage(createChatDto.content)] } as any,
      { configurable: { thread_id: id }, streamMode: 'messages' } as any,
    );
    return stream; //返回的是一个迭代器
  }

  async getUserHistory(userId: string, role: ChatRoleType) {
    await this.prompts.resolve(userId, role);
    const messages = await this.checkPointer.get({
      configurable: { thread_id: `${userId}-${role}` },
    });
    const list = messages?.channel_values?.messages as AIMessageChunk[];
    if (!list) return this.responseService.success([]); //如果历史记录为空，则返回空数组
    return this.responseService.success(
      list.map((item) => ({
        content: item.content,
        role: item.type,
        reasoning: item.additional_kwargs?.reasoning_content, //返回深度思考的内容
      })),
    );
  }
}
