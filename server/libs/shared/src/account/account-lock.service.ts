import { ConflictException, Injectable, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PrismaService } from '../prisma/prisma.service';

// Cross-process lock: deletion must not race with checkpoint writes or queued emails.
@Injectable()
export class AccountLockService implements OnModuleDestroy {
  private readonly pool: Pool;
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    this.pool = new Pool({ connectionString: config.get('DATABASE_URL'), max: 10 });
  }
  async withUser<T>(userId: string, action: () => Promise<T>, deleting = false): Promise<T> {
    const client = await this.pool.connect();
    const lock = deleting ? 'pg_try_advisory_lock' : 'pg_try_advisory_lock_shared';
    const unlock = deleting ? 'pg_advisory_unlock' : 'pg_advisory_unlock_shared';
    let acquired = false;
    try {
      const result = await client.query(`SELECT ${lock}(hashtextextended($1, 0)) AS acquired`, [`account:${userId}`]);
      acquired = result.rows[0].acquired;
      if (!acquired) throw new ConflictException('账号正在处理聊天或报告任务，请稍后重试');
      if (!await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } })) {
        throw new UnauthorizedException('账号已注销或不存在');
      }
      return await action();
    } finally {
      try {
        if (acquired) await client.query(`SELECT ${unlock}(hashtextextended($1, 0))`, [`account:${userId}`]);
      } finally { client.release(); }
    }
  }
  async onModuleDestroy() { await this.pool.end(); }
}
