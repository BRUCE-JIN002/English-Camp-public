import { AccountLockService } from '@libs/shared/account/account-lock.service';
import type { RefreshTokenPayload } from '@en/common/user';
import { Controller, Get, Post, Body, Res, Query, Req, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import type { ChatDto, ChatRoleType } from '@en/common/chat';
import { AuthGuard } from '@libs/shared/auth/auth.guard';
import type { Request, Response } from 'express';

@UseGuards(AuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService, private readonly locks: AccountLockService) {}

  @Post()
  async startChat(@Body() ChatDto: ChatDto, @Res() res: Response, @Req() req: Request & { user: RefreshTokenPayload }) {
    return this.locks.withUser(req.user.userId, async () => {
    const stream = await this.chatService.streamCompletion({ ...ChatDto, userId: req.user.userId });
    res.setHeader('Content-Type', 'text/event-stream'); //SSE流式输出
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    for await (const chunk of stream) {
      const [msg] = chunk;
      //深度思考返回的内容不在content中，在additional_kwargs.reasoning_content中
      const thinkMsg = msg.additional_kwargs?.reasoning_content ?? '';
      if (thinkMsg) {
        res.write(
          `data: ${JSON.stringify({ content: thinkMsg, role: 'ai', type: 'reasoning' })}\n\n`,
        );
      }
      const content = msg.content ?? ''; //普通Chat对话的内容
      if (content) {
        res.write(
          `data: ${JSON.stringify({ content: content, role: 'ai', type: 'chat' })}\n\n`,
        );
      }
    }
    res.end();
    });
  }

  @Get('history')
  getUserHistory(
    @Req() req: Request & { user: RefreshTokenPayload },
    @Query('role') role: ChatRoleType,
  ) {
    return this.chatService.getUserHistory(req.user.userId, role);
  }
}
