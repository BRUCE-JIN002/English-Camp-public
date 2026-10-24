import type { RefreshTokenPayload } from '@en/common/user';
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { PromptService } from './prompt.service';
import { AuthGuard } from '@libs/shared/auth/auth.guard';
import type { Request } from 'express';
import type { ChatAgentInput } from '@en/common/chat';

@UseGuards(AuthGuard)
@Controller('prompt')
export class PromptController {
  constructor(private readonly promptService: PromptService) {}
  @Get('list')
  findAll(@Req() req: Request & { user: RefreshTokenPayload }) { return this.promptService.findAll(req.user.userId); }
  @Post()
  create(@Req() req: Request & { user: RefreshTokenPayload }, @Body() input: ChatAgentInput) { return this.promptService.create(req.user.userId, input); }
  @Patch(':role')
  update(@Req() req: Request & { user: RefreshTokenPayload }, @Param('role') role: string, @Body() input: ChatAgentInput) { return this.promptService.update(req.user.userId, role, input); }
  @Delete(':role')
  remove(@Req() req: Request & { user: RefreshTokenPayload }, @Param('role') role: string) { return this.promptService.remove(req.user.userId, role); }
}
