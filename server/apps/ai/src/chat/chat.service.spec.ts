import { ChatService } from './chat.service';
import { PromptService } from '../prompt/prompt.service';
import { ResponseService } from '@libs/shared';
import { createAgent } from 'langchain';
import { createCheckPointer } from '../llm/llm.config';

jest.mock('langchain', () => ({ createAgent: jest.fn() }));
jest.mock('../llm/llm.config', () => ({ createCheckPointer: jest.fn(), createDeepSeek: jest.fn(() => ({})), createDeepSeekReasoner: jest.fn(() => ({})), createBochaSearch: jest.fn() }));
jest.mock('@langchain/core/messages', () => ({ HumanMessage: class { constructor(public content: string) {} } }));
jest.mock('@libs/shared', () => ({ ResponseService: class {} }));

describe('ChatService custom agents', () => {
  it('uses the saved persona for each reply and preserves the user/role history key', async () => {
    const resolve = jest.fn().mockResolvedValueOnce({ prompt: 'First persona' }).mockResolvedValueOnce({ prompt: 'Edited persona' });
    const stream = jest.fn().mockResolvedValue([]);
    (createAgent as jest.Mock).mockReturnValue({ stream });
    (createCheckPointer as jest.Mock).mockResolvedValue({});
    const service = new ChatService({} as ResponseService, { resolve } as unknown as PromptService);
    await service.onModuleInit();
    const input = { userId: 'user-a', role: 'custom-id', content: 'Hello', deepThink: false, webSearch: false };
    await service.streamCompletion(input);
    await service.streamCompletion(input);
    expect(resolve).toHaveBeenLastCalledWith('user-a', 'custom-id');
    expect(createAgent).toHaveBeenNthCalledWith(1, expect.objectContaining({ systemPrompt: 'First persona' }));
    expect(createAgent).toHaveBeenNthCalledWith(2, expect.objectContaining({ systemPrompt: 'Edited persona' }));
    expect(stream).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ configurable: { thread_id: 'user-a-custom-id' } }));
  });
  it('rejects deleted or foreign agents before calling the model', async () => {
    (createAgent as jest.Mock).mockClear();
    const service = new ChatService({} as ResponseService, { resolve: jest.fn().mockRejectedValue(new Error('Agent unavailable')) } as unknown as PromptService);
    await expect(service.streamCompletion({ userId: 'user-b', role: 'custom-id', content: 'Hello', deepThink: false, webSearch: false })).rejects.toThrow('Agent unavailable');
    expect(createAgent).not.toHaveBeenCalled();
  });
});
