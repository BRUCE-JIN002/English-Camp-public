import { PromptModule } from '../prompt/prompt.module';
import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';

@Module({
  imports: [PromptModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
