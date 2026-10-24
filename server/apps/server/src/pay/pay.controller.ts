import { Controller, Post, Body, UseGuards, Req, Res, Get, Query } from '@nestjs/common';
import { PayService } from './pay.service';
import { CreatePayDto } from '@en/common/pay';
import { AuthGuard } from '@libs/shared/auth/auth.guard';
import type { Request, Response } from 'express';

@Controller('pay')
export class PayController {
  constructor(private readonly payService: PayService) {}

  @UseGuards(AuthGuard)
  @Post('create')
  create(@Body() createPayDto: CreatePayDto, @Req() req: Request) {
    const user = req.user;
    return this.payService.create(createPayDto, user);
  }

  @UseGuards(AuthGuard)
  @Get('status')
  status(@Query('courseId') courseId: string, @Req() req: Request) {
    return this.payService.status(courseId, req.user);
  }

  @Post('notify')
  async notify(@Req() req: Request, @Res() res: Response) {
    const result = await this.payService.notify(req);
    res.status(200).type('text/plain').send(result);
  }
}
