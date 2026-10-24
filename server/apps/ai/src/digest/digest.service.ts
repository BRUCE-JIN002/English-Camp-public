import { AccountLockService } from '@libs/shared/account/account-lock.service';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@libs/shared';
import * as dayjs from 'dayjs';
import { createAgent } from 'langchain';
import { createDeepSeek } from '../llm/llm.config';
import { tool } from '@langchain/core/tools';
import { HumanMessage } from '@langchain/core/messages';
import * as marked from 'marked';
import { Queue } from 'bullmq';
import { digestQueueName } from './digest.queue';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class DigestService implements OnModuleInit {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly locks: AccountLockService,
    @InjectQueue(digestQueueName.name) private readonly digestQueue: Queue,
  ) {}

  private queryTool() {
    return tool(
      async ({ userId }: { userId: string }) => {
        const user = await this.prismaService.user.findFirst({
          where: { id: userId },
          select: {
            email: true,
            name: true,
            wordNumber: true,
            wordBookRecords: {
              where: {
                createdAt: {
                  gte: dayjs().startOf('day').toDate(),
                  lte: dayjs().add(1, 'day').startOf('day').toDate(),
                },
              },
              select: {
                word: { select: { word: true } },
              },
            },
          },
        });
        return user;
      },
      {
        name: 'queryTool',
        description: '根据用户id查询用户每日学习的单词记录',
        schema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: '用户id' },
          },
          required: ['userId'],
        },
      },
    );
  }

  async onModuleInit() {
    await this.digestQueue.upsertJobScheduler(
      digestQueueName.task.everyDayDigest,
      { pattern: '0 0 * * *' },
      {
        name: digestQueueName.task.everyDayDigest,
        data: {},
        opts: { removeOnComplete: true, removeOnFail: 10 },
      },
    );
    console.log('Digest 定时任务已注册: 每天 0:00 (UTC) / 8:00 (北京时间)');
  }

  async handleEmailDigest(forceImmediate = false) {
    const userIds = await this.prismaService.user.findMany({
      where: {
        isTimingTask: true,
        timingTaskTime: { not: '' },
        email: { not: null },
      },
      select: {
        id: true,
        name: true,
        timingTaskTime: true,
        email: true,
      },
    });
    for (const user of userIds) {
      let html = await this.generateDigestReport(user.id);
      if (!html) {
        html = this.generateReminderHtml(user.name);
      }
      await this.enqueueDigest(
        user.id,
        user.timingTaskTime,
        user.email!,
        html,
        forceImmediate,
      );
    }
  }

  private async generateDigestReport(userId: string): Promise<string | null> {
    try {
      const agent = createAgent({
        model: createDeepSeek(),
        tools: [this.queryTool()],
        systemPrompt:
          '你是一个单词记忆助手，根据用户信息和单词记录，生成单词记忆报告',
      });
      const result = await (agent as any).invoke({
        messages: [
          new HumanMessage(
            `查询用户信息,并且根据用户id关联单词记录表，查询出用户今天的单词记录,用户id: ${userId}，过滤掉敏感信息`,
          ),
        ],
      });
      const content = result.messages.at(-1)?.content;
      if (!content) return null;
      return marked.parse(content as string);
    } catch (err) {
      console.error('Digest AI 生成失败:', err);
      return null;
    }
  }

  private generateReminderHtml(name: string): string {
    const displayName = name || '同学';
    return `<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: linear-gradient(135deg, #faf5ff 0%, #eff6ff 100%); border-radius: 16px;">
      <h2 style="color: #6366f1; margin: 0 0 16px;">📚 今日学习提醒</h2>
      <p style="font-size: 16px; color: #334155; line-height: 1.6;">Hi, <strong>${displayName}</strong>！</p>
      <p style="font-size: 16px; color: #334155; line-height: 1.6;">今天还没有开始学习哦 😊</p>
      <p style="font-size: 16px; color: #334155; line-height: 1.6;">每天坚持学习一小会，日积月累你会看到惊人的进步 💪</p>
      <div style="margin-top: 20px; padding: 16px; background: rgba(255,255,255,0.7); border-radius: 12px; border: 1px solid rgba(255,255,255,0.8);">
        <p style="font-size: 14px; color: #64748b; margin: 0;">现在就去学习几个单词吧 → <a href="http://localhost:8080/course" style="color: #6366f1; text-decoration: none; font-weight: 600;">进入课程</a></p>
      </div>
    </div>`;
  }

  private async enqueueDigest(
    userId: string,
    timingTaskTime: string,
    email: string,
    html: string,
    forceImmediate = false,
  ) {
    const [hour, minute, second] = timingTaskTime.split(':').map(Number);
    const target = dayjs()
      .startOf('day')
      .set('hour', hour)
      .set('minute', minute)
      .set('second', second);
    let delay = forceImmediate ? 0 : target.diff(dayjs());
    if (delay < 0) delay = 0;

    return this.locks.withUser(userId, async () =>
      this.digestQueue.add(
        digestQueueName.task.emailDigest,
        { userId, text: html, email },
        { delay, jobId: `digest-${userId}-${dayjs().format('YYYY-MM-DD')}` },
      ),
    );
  }

  async rescheduleUserDigest(
    userId: string,
    timingTaskTime: string,
    isTimingTask: boolean,
  ) {
    const today = dayjs().format('YYYY-MM-DD');
    const jobId = `digest-${userId}-${today}`;
    const job = await this.digestQueue.getJob(jobId);

    if (!isTimingTask || !timingTaskTime) {
      if (job) await job.remove();
      return;
    }

    let html = '';
    if (job && job.data.text) {
      html = job.data.text;
      await job.remove();
    } else {
      if (job) await job.remove();
      html = (await this.generateDigestReport(userId)) || '';
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user?.email) return;

    if (!html) {
      html = this.generateReminderHtml(user.name || '');
    }

    const [hour, minute, second] = timingTaskTime.split(':').map(Number);
    const target = dayjs()
      .startOf('day')
      .set('hour', hour)
      .set('minute', minute)
      .set('second', second);
    let delay = target.diff(dayjs());
    if (delay < 0) delay = 0;

    return this.locks.withUser(userId, async () =>
      this.digestQueue.add(
        digestQueueName.task.emailDigest,
        { userId, text: html, email: user.email },
        { delay, jobId },
      ),
    );
  }
}
