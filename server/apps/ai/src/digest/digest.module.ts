import { Module } from '@nestjs/common';
import { DigestService } from './digest.service';
import { BullModule } from '@nestjs/bullmq';
import { digestQueueName } from './digest.queue';
import { DigestProcessor } from './digest.processor';
import { DigestController } from './digest.controller';

@Module({
  providers: [DigestService, DigestProcessor],
  imports: [BullModule.registerQueue({ name: digestQueueName.name })],
  controllers: [DigestController],
})
export class DigestModule {}
