import { Controller, Post, Query, Body } from '@nestjs/common';
import { DigestService } from './digest.service';

@Controller('digest')
export class DigestController {
  constructor(private readonly digestService: DigestService) {}

  @Post('trigger')
  async triggerDigest(@Query('immediate') immediate?: string) {
    const forceImmediate = immediate !== 'false';
    await this.digestService.handleEmailDigest(forceImmediate);
    return { success: true, message: 'Digest 任务已执行' };
  }

  @Post('reschedule')
  async reschedule(
    @Body()
    body: {
      userId: string;
      timingTaskTime: string;
      isTimingTask: boolean;
    },
  ) {
    await this.digestService.rescheduleUserDigest(
      body.userId,
      body.timingTaskTime,
      body.isTimingTask,
    );
    return { success: true };
  }
}
