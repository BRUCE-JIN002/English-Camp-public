import { AccountLockService } from '@libs/shared/account/account-lock.service';
import { PrismaService } from '@libs/shared/prisma/prisma.service';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { digestQueueName } from './digest.queue';
import { DigestService } from './digest.service';
import { MailService } from '@libs/shared';

@Processor(digestQueueName.name)
export class DigestProcessor extends WorkerHost {
  constructor(
    private readonly digestService: DigestService,
    private readonly locks: AccountLockService,
    private readonly prisma: PrismaService,
    private readonly emailService: MailService,
  ) {
    super();
  }
  async process(job: Job) {
    if (job.name === digestQueueName.task.emailDigest) {
      const { text, email, userId } = job.data;
      if (
        !userId ||
        !(await this.prisma.user.findUnique({ where: { id: userId } }))
      )
        return;
      await this.locks.withUser(userId, () =>
        this.emailService.sendEmail(email, '每日单词记忆报告', text),
      );
    }
    if (job.name === digestQueueName.task.everyDayDigest) {
      await this.digestService.handleEmailDigest();
    }
  }
}
