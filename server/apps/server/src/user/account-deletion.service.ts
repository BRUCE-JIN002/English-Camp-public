import { BadRequestException, ConflictException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Pool } from 'pg';
import { PrismaService } from '@libs/shared/prisma/prisma.service';
import { AccountLockService } from '@libs/shared/account/account-lock.service';

@Injectable()
export class AccountDeletionService implements OnModuleDestroy {
  private readonly chatPool: Pool;
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly locks: AccountLockService,
    @InjectQueue('DIGEST_QUEUE') private readonly queue: Queue,
  ) {
    this.chatPool = new Pool({ connectionString: config.getOrThrow('AI_DATABASE_URL') });
  }

  async deleteAccount(userId: string, confirmation: unknown) {
    if (confirmation !== '注销账户') throw new BadRequestException('请输入“注销账户”确认操作');
    return this.locks.withUser(userId, async () => {
      const jobs = await this.queue.getJobs(['wait', 'active', 'delayed', 'paused', 'completed', 'failed', 'waiting-children']);
      const ownedJobs = jobs.filter(job => job.data?.userId === userId);
      for (const job of ownedJobs) {
        if (await job.isActive()) throw new ConflictException('学习报告正在处理，请稍后重试注销');
      }
      for (const job of ownedJobs) await job.remove();

      const client = await this.chatPool.connect();
      try {
        await client.query('BEGIN');
        // Exact prefix, bound as a value: user IDs must never become LIKE patterns.
        for (const table of ['checkpoint_writes', 'checkpoint_blobs', 'checkpoints']) {
          const exists = await client.query('SELECT to_regclass($1) AS name', [table]);
          if (exists.rows[0].name) {
            await client.query(`DELETE FROM ${table} WHERE left(thread_id, length($1)) = $1`, [`${userId}-`]);
          }
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
      // Keep the account until external cleanup succeeds, so a failure can be retried.
      // FK cascades remove learning, purchases, check-ins, agents and visitor metrics.
      await this.prisma.user.delete({ where: { id: userId } });
      return { code: 200, message: '账户已注销', data: null };
    }, true);
  }
  async onModuleDestroy() { await this.chatPool.end(); }
}
