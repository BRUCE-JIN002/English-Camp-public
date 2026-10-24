import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { chatMode } from './prompt.mode';
import { PrismaService, ResponseService } from '@libs/shared';
import type { ChatAgentInput, ChatMode } from '@en/common/chat';
import { agentAccentColors, defaultAgentAccentColor } from '@en/common/chat/colors.js';

@Injectable()
export class PromptService {
  constructor(private readonly response: ResponseService, private readonly prisma: PrismaService) {}

  private defaults(): ChatMode[] {
    return chatMode.map(item => {
      const [icon, ...name] = item.label.split(' ');
      return { ...item, id: item.role, name: name.join(' '), icon, isDefault: true, accentColor: defaultAgentAccentColor };
    });
  }

  async list(userId: string): Promise<ChatMode[]> {
    const rows = await this.prisma.chatAgent.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    const overrides = new Map(rows.map(row => [row.role, row]));
    const defaults = this.defaults();
    const roles = new Set(defaults.map(item => item.role));
    const format = (item: ChatAgentInput & { role: string }, isDefault: boolean): ChatMode => ({
      id: item.role, role: item.role, name: item.name, icon: item.icon, prompt: item.prompt,
      label: `${item.icon} ${item.name}`, isDefault, accentColor: item.accentColor ?? defaultAgentAccentColor,
    });
    return [
      ...defaults.flatMap(item => {
        const row = overrides.get(item.role);
        return row?.deleted ? [] : [row ? format(row, true) : item];
      }),
      ...rows.filter(row => !row.deleted && !roles.has(row.role)).map(row => format(row, false)),
    ];
  }

  async resolve(userId: string, role: string) {
    const agent = (await this.list(userId)).find(item => item.role === role);
    if (!agent) throw new NotFoundException('Agent 不存在或已删除');
    return agent;
  }

  private validate(input: ChatAgentInput): ChatAgentInput {
    const limits = { name: 30, icon: 16, prompt: 6000 };
    const result = {} as ChatAgentInput;
    for (const key of ['name', 'icon', 'prompt'] as const) {
      const value = input?.[key];
      if (typeof value !== 'string' || !value.trim() || value.trim().length > limits[key]) {
        throw new BadRequestException(`${key === 'name' ? '名称' : key === 'icon' ? '图标' : '人物设定'}不能为空，且不能超过 ${limits[key]} 个字符`);
      }
      result[key] = value.trim();
    }
    if (input.accentColor !== undefined) {
      if (!agentAccentColors.some(color => color.value === input.accentColor)) {
        throw new BadRequestException('请选择有效的强调色');
      }
      result.accentColor = input.accentColor;
    }
    return result;
  }

  async findAll(userId: string) { return this.response.success(await this.list(userId)); }

  async create(userId: string, input: ChatAgentInput) {
    const data = this.validate(input);
    const role = `custom-${randomUUID()}`;
    await this.prisma.chatAgent.create({ data: { userId, role, ...data } });
    return this.response.success(await this.resolve(userId, role));
  }

  async update(userId: string, role: string, input: ChatAgentInput) {
    await this.resolve(userId, role);
    const data = this.validate(input);
    await this.prisma.chatAgent.upsert({
      where: { userId_role: { userId, role } },
      create: { userId, role, ...data }, update: data,
    });
    return this.response.success(await this.resolve(userId, role));
  }

  async remove(userId: string, role: string) {
    const agent = await this.resolve(userId, role);
    await this.prisma.chatAgent.upsert({
      where: { userId_role: { userId, role } },
      create: { userId, role, name: agent.name, icon: agent.icon, prompt: agent.prompt, deleted: true },
      update: { deleted: true },
    });
    return this.response.success(null);
  }
}
