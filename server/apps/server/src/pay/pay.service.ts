import { CreatePayDto } from '@en/common/pay';
import { Injectable, Logger } from '@nestjs/common';
import type { TokenPayload } from '@en/common/user';
import { PrismaService } from '@libs/shared';
import * as nanoid from 'nanoid';
import * as dayjs from 'dayjs';
import { PayService as SharedPayService, ResponseService } from '@libs/shared';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { TradeStatus } from '@libs/shared/generated/prisma/enums';
import { SocketGateway } from '../socket/socket.gateway';

@Injectable()
export class PayService {
  private readonly logger = new Logger(PayService.name);
  constructor(
    private readonly prismaService: PrismaService,
    private readonly sharedPayService: SharedPayService,
    private readonly configService: ConfigService,
    private readonly responseService: ResponseService,
    private readonly socketGateway: SocketGateway,
  ) {}

  // 生成订单编号
  private createTradeNo() {
    const prifix = 'GK'; //订单前缀
    return `${prifix}-${nanoid.nanoid(12)}`;
  }

  async create(createPayDto: CreatePayDto, user: TokenPayload) {
    //购买过课程不能重复购买
    const courseRecord = await this.prismaService.courseRecord.findFirst({
      where: {
        userId: user.userId,
        courseId: createPayDto.courseId,
      },
    });
    if (courseRecord) {
      return this.responseService.error(null, '您已经购买过该课程');
    }
    const course = await this.prismaService.course.findUnique({ where: { id: createPayDto.courseId } });
    if (!course) return this.responseService.error(null, '课程不存在');
    const notifyBase = this.configService.get<string>('ALIPAY_NOTIFY_URL');
    if (!notifyBase) return this.responseService.error(null, '支付回调地址未配置');
    const notifyUrl = new URL(notifyBase);
    if (!['http:', 'https:'].includes(notifyUrl.protocol)) throw new Error('Invalid payment callback URL');
    notifyUrl.pathname = notifyUrl.pathname.replace(/\/$/, '') + '/api/v1/pay/notify';
    const result = await this.prismaService.$transaction(async (tx) => {
      //1. 创建订单表 但是状态是未支付
      const outTradeNo = this.createTradeNo();
      await tx.paymentRecord.create({
        data: {
          userId: user.userId, //用户id
          outTradeNo: outTradeNo, //订单编号
          amount: course.price, //支付金额
          subject: course.name, //支付主题
          body: JSON.stringify({ courseId: course.id }), //支付内容
        },
      });
      //2.支付宝SDK发起支付生成url
      const dateTime = dayjs().add(15, 'minute'); // 留出沙箱登录和支付时间
      const payUrl = this.sharedPayService
        .getAlipaySdk()
        .pageExecute('alipay.trade.page.pay', 'GET', {
          bizContent: {
            out_trade_no: outTradeNo, //订单编号
            total_amount: course.price.toFixed(2), //支付金额
            subject: course.name, //支付主题
            body: JSON.stringify({
              courseId: createPayDto.courseId, //课程id
              userId: user.userId, //用户id
            }), //支付内容
            product_code: 'FAST_INSTANT_TRADE_PAY', //产品编码
            timeout_express: '15m', // 相对超时，避免部署服务器时区影响
          },
          notify_url: notifyUrl.toString(),
        });
      return {
        payUrl, //返回支付宝的支付链接
        timeExpire: dateTime.toDate().getTime(), //迎合Elementplus组件要求是时间戳
      };
    });

    return this.responseService.success(result);
  }

  async notify(req: Request): Promise<'success' | 'failure'> {
    const data = req.body;
    try {
      if (!data || !this.sharedPayService.getAlipaySdk().checkNotifySignV2(data)) return 'failure';
      if (data.app_id !== this.configService.get<string>('ALIPAY_APP_ID')) return 'failure';
      const sellerId = this.configService.get<string>('ALIPAY_SELLER_ID');
      if (sellerId && data.seller_id !== sellerId) return 'failure';
      const order = await this.prismaService.paymentRecord.findUnique({ where: { outTradeNo: data.out_trade_no } });
      if (!order || typeof data.total_amount !== 'string' || !/^\d+(\.\d{1,2})?$/.test(data.total_amount) || !order.amount.equals(data.total_amount)) return 'failure';
      if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(data.trade_status)) return 'success';
      if (typeof data.trade_no !== 'string' || !data.trade_no) return 'failure';
      // New orders bind the course locally; old sandbox orders use the verified signed body.
      let binding: { courseId: string; userId?: string };
      try { binding = JSON.parse(order.body); } catch { binding = JSON.parse(data.body); }
      if (!binding?.courseId || (binding.userId && binding.userId !== order.userId)) return 'failure';
      if (typeof data.gmt_payment !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(data.gmt_payment)) return 'failure';
      const paidAt = new Date(data.gmt_payment.replace(' ', 'T') + '+08:00');
      if (Number.isNaN(paidAt.getTime())) return 'failure';
      await this.settle(order, binding.courseId, data.trade_no, data.trade_status, paidAt);
      return 'success';
    } catch {
      this.logger.warn('Payment notification rejected or persistence failed');
      return 'failure';
    }
  }

  private async settle(order: any, courseId: string, tradeNo: string, tradeStatus: TradeStatus, paidAt: Date) {
      const changed = await this.prismaService.$transaction(async (tx) => {
        // Conditional update serializes concurrent deliveries for the same order.
        const updated = await tx.paymentRecord.updateMany({
          where: { id: order.id, tradeStatus: { notIn: [TradeStatus.TRADE_SUCCESS, TradeStatus.TRADE_FINISHED] } },
          data: { tradeNo: tradeNo, tradeStatus: tradeStatus, sendPayTime: paidAt },
        });
        if (!updated.count) return false;
        await tx.courseRecord.upsert({
          where: { userId_courseId: { userId: order.userId, courseId: courseId } },
          create: { userId: order.userId, courseId: courseId, isPurchased: true, paymentRecordId: order.id },
          update: { isPurchased: true, paymentRecordId: order.id },
        });
        return true;
      });
      if (changed) this.socketGateway.emitPaymentSuccess(order.userId);

  }

  async status(courseId: string, user: TokenPayload) {
    const purchased = await this.prismaService.courseRecord.findUnique({
      where: { userId_courseId: { userId: user.userId, courseId } },
    });
    if (purchased?.isPurchased) return this.responseService.success({ paid: true });
    const orders = await this.prismaService.paymentRecord.findMany({
      where: { userId: user.userId, tradeStatus: TradeStatus.NOT_PAY,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' }, take: 20,
    });
    const candidates = orders.filter(order => {
      try { return JSON.parse(order.body).courseId === courseId; } catch { return false; }
    }).slice(0, 3);
    try {
      for (const order of candidates) {
        const result = await this.sharedPayService.getAlipaySdk().exec('alipay.trade.query', {
          bizContent: { out_trade_no: order.outTradeNo },
        }, { validateSign: true });
        if (result.code === '40004' && result.subCode === 'ACQ.TRADE_NOT_EXIST') continue;
        if (result.code !== '10000') throw new Error('Payment query failed');
        if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(result.tradeStatus)) continue;
        if (result.outTradeNo !== order.outTradeNo || !result.tradeNo || !order.amount.equals(result.totalAmount)) throw new Error('Payment query mismatch');
        await this.settle(order, courseId, result.tradeNo, result.tradeStatus as TradeStatus,
          result.sendPayDate ? new Date(result.sendPayDate.replace(' ', 'T') + '+08:00') : new Date());
        return this.responseService.success({ paid: true });
      }
      return this.responseService.success({ paid: false });
    } catch {
      this.logger.warn('Alipay order query unavailable; payment status remains unconfirmed');
      return this.responseService.error({ paid: false }, '支付状态暂时无法确认，请稍后重试，请勿重复付款', 503);
    }
  }
}
