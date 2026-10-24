import {
  Body,
  Controller,
  Get,
  Param,
  Query,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LearnService } from './learn.service';
import { AuthGuard } from '@libs/shared/auth/auth.guard';
import type { Request } from 'express';

@Controller('learn')
export class LearnController {
  constructor(private readonly learnService: LearnService) {}

  @UseGuards(AuthGuard)
  @Get('learned')
  getLearnedWords(@Req() req: Request, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.learnService.getLearnedWords(req.user.userId, page, pageSize);
  }

  @UseGuards(AuthGuard)
  @Post('word/master')
  saveWordList(
    @Body() { wordIds }: { wordIds: string[] },
    @Req() req: Request,
  ) {
    const userId = req.user.userId;
    return this.learnService.saveWordList(wordIds, userId);
  }

  @UseGuards(AuthGuard)
  @Get('word/:id')
  getWordList(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user.userId;
    return this.learnService.getWordList(id, userId);
  }

  @UseGuards(AuthGuard)
  @Get('checkin/status')
  getCheckInStatus(@Req() req: Request) {
    const userId = req.user.userId;
    return this.learnService.getCheckInStatus(userId);
  }

  @UseGuards(AuthGuard)
  @Post('checkin')
  checkIn(@Req() req: Request) {
    const userId = req.user.userId;
    return this.learnService.checkIn(userId);
  }
}
