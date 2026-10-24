import { BullModule } from '@nestjs/bullmq';
import { AccountDeletionService } from './account-deletion.service';
import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [UserController],
  providers: [UserService, AccountDeletionService],
  imports: [AuthModule, BullModule.registerQueue({ name: 'DIGEST_QUEUE' })],
})
export class UserModule {}
