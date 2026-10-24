import { ChatDeepSeek } from '@langchain/deepseek';
import { ConfigService } from '@nestjs/config';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

//初始化deepseek模型
export const createDeepSeek = () => {
  const configService = new ConfigService();
  return new ChatDeepSeek({
    apiKey: configService.get<string>('DEEPSEEK_API_KEY'), //从环境变量中获取api key
    model: configService.get<string>('DEEPSEEK_API_MODEL'), //从环境变量中获取模型
    temperature: 1.3, //1.3翻译 + 通用对话
    maxTokens: 4396, //token限制
    streaming: true, //流式输出
  });
};

//初始化deepseek 深度思考模型
export const createDeepSeekReasoner = () => {
  const configService = new ConfigService();
  return new ChatDeepSeek({
    apiKey: configService.get<string>('DEEPSEEK_API_KEY'), //从环境变量中获取api key
    model: configService.get<string>('DEEPSEEK_REASONER_API_MODEL'), //从环境变量中获取模型
    temperature: 1.3, //1.3翻译 + 通用对话
    maxTokens: 23296, //token限制
    streaming: true, //流式输出
  });
};

//初始化checkpoint
export const createCheckPointer = async () => {
  const configService = new ConfigService();
  const checkpointer = PostgresSaver.fromConnString(
    configService.get<string>('AI_DATABASE_URL')!,
  );
  await checkpointer.setup();
  return checkpointer;
};

//初始化博查搜索API
export const createBochaSearch = async (query: string, count: number = 10) => {
  const configService = new ConfigService();
  const url = configService.get<string>('BOCHA_SEARCH_URL');
  const apiKey = configService.get<string>('BOCHA_API_KEY');

  if (!url || !apiKey) {
    console.error('[BochaSearch] BOCHA_SEARCH_URL 或 BOCHA_API_KEY 未配置');
    return '';
  }

  const result = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, count, summary: true }),
  });

  const json = await result.json();
  const data = json.data;
  if (!data) {
    console.error(
      '[BochaSearch] 响应异常:',
      JSON.stringify(json).slice(0, 300),
    );
    return '';
  }

  const webPages = data.webPages;
  if (!webPages || !webPages.value || webPages.value.length === 0) {
    return '';
  }

  const prompt = webPages.value
    .map(
      (item: any) => `
       标题：${item.name}
       链接：${item.url}
       摘要：${item?.summary?.replace(/\n/g, '') ?? ''}
       网站名称：${item.siteName}
       网站logo：${item.siteIcon}
       发布时间：${item.dateLastCrawled}
    `,
    )
    .join('\n');
  return prompt;
};
