jest.mock('nanoid', () => ({ nanoid: () => 'test-order' }));
import { PayService } from './pay.service';
import { AlipaySdk } from 'alipay-sdk';
import { generateKeyPairSync } from 'crypto';
import { Decimal } from '@prisma/client/runtime/client';

describe('sandbox payment notifications', () => {
  let service: PayService;
  let db: any;
  let sdk: any;
  let socket: any;
  let request: any;
  beforeEach(() => {
    sdk = { checkNotifySignV2: jest.fn(() => true) };
    const tx = {
      paymentRecord: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      courseRecord: { upsert: jest.fn().mockResolvedValue({}) },
    };
    db = {
      paymentRecord: { findUnique: jest.fn().mockResolvedValue({ id: 'p', userId: 'u', body: '{"courseId":"c"}', amount: { equals: (v: string) => v === '9.99' } }) },
      $transaction: jest.fn((fn) => fn(tx)), tx,
    };
    socket = { emitPaymentSuccess: jest.fn() };
    service = new PayService(db, { getAlipaySdk: () => sdk } as any, { get: (key: string) => key === 'ALIPAY_APP_ID' ? 'app' : undefined } as any, {} as any, socket);
    request = { body: { app_id: 'app', out_trade_no: 'order', trade_no: 'trade', total_amount: '9.99', trade_status: 'TRADE_SUCCESS', gmt_payment: '2026-10-24 12:00:00' } };
  });
  it('rejects invalid signatures without accessing orders', async () => {
    sdk.checkNotifySignV2.mockReturnValue(false);
    expect(await service.notify(request)).toBe('failure');
    expect(db.paymentRecord.findUnique).not.toHaveBeenCalled();
  });
  it.each([['total_amount', '0.01'], ['app_id', 'other']])('rejects mismatched %s', async (key, value) => {
    request.body[key] = value;
    expect(await service.notify(request)).toBe('failure');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('does not grant access for pending trades', async () => {
    request.body.trade_status = 'WAIT_BUYER_PAY';
    expect(await service.notify(request)).toBe('success');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('commits access before notifying the browser', async () => {
    expect(await service.notify(request)).toBe('success');
    expect(db.tx.courseRecord.upsert).toHaveBeenCalled();
    expect(socket.emitPaymentSuccess).toHaveBeenCalledWith('u');
  });
  it('acknowledges duplicate deliveries without granting twice', async () => {
    db.tx.paymentRecord.updateMany.mockResolvedValue({ count: 0 });
    expect(await service.notify(request)).toBe('success');
    expect(db.tx.courseRecord.upsert).not.toHaveBeenCalled();
    expect(socket.emitPaymentSuccess).not.toHaveBeenCalled();
  });
  it('reconciles a provider-confirmed paid order when notification was missed', async () => {
    const order = await db.paymentRecord.findUnique();
    order.outTradeNo = 'order';
    db.courseRecord = { findUnique: jest.fn().mockResolvedValue(null) };
    db.paymentRecord.findMany = jest.fn().mockResolvedValue([order]);
    sdk.exec = jest.fn().mockResolvedValue({ code: '10000', outTradeNo: 'order', tradeNo: 'trade', totalAmount: '9.99', tradeStatus: 'TRADE_SUCCESS' });
    const statusService = new PayService(db, { getAlipaySdk: () => sdk } as any, {} as any,
      { success: (data: any) => ({ data }), error: () => ({ data: { paid: false } }) } as any, socket);
    const result = await statusService.status('c', { userId: 'u' } as any);
    expect(result.data.paid).toBe(true);
    expect(sdk.exec).toHaveBeenCalledWith('alipay.trade.query', expect.anything(), { validateSign: true });
    expect(db.paymentRecord.findMany.mock.calls[0][0].where.userId).toBe('u');
    expect(db.tx.courseRecord.upsert).toHaveBeenCalled();
  });
  it('does not grant access when provider query fails', async () => {
    const order = await db.paymentRecord.findUnique();
    db.courseRecord = { findUnique: jest.fn().mockResolvedValue(null) };
    db.paymentRecord.findMany = jest.fn().mockResolvedValue([order]);
    sdk.exec = jest.fn().mockRejectedValue(new Error('timeout'));
    const statusService = new PayService(db, { getAlipaySdk: () => sdk } as any, {} as any,
      { error: (data: any) => ({ data }) } as any, socket);
    expect((await statusService.status('c', { userId: 'u' } as any)).data.paid).toBe(false);
    expect(db.tx.courseRecord.upsert).not.toHaveBeenCalled();
  });
  it('asks for retry when persistence fails', async () => {
    db.$transaction.mockRejectedValue(new Error('unavailable'));
    expect(await service.notify(request)).toBe('failure');
    expect(socket.emitPaymentSuccess).not.toHaveBeenCalled();
  });
});


describe('sandbox payment link', () => {
  it('serializes the database Decimal as a two-decimal amount through the real SDK', async () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const sdk = new AlipaySdk({ appId: 'test', privateKey, gateway: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do' });
    const db: any = {
      courseRecord: { findFirst: async () => null },
      course: { findUnique: async () => ({ id: 'c', name: '测试课程', price: new Decimal('9.9') }) },
      $transaction: async (fn: any) => fn({ paymentRecord: { create: async () => ({}) } }),
    };
    const service = new PayService(db, { getAlipaySdk: () => sdk } as any,
      { get: () => 'https://callback.example.com' } as any,
      { success: (value: any) => ({ data: value }) } as any, {} as any);
    const result = await service.create({ courseId: 'c', total_amount: '0.01', subject: 'untrusted', body: '' }, { userId: 'u' } as any);
    const url = new URL(result.data.payUrl);
    const biz = JSON.parse(url.searchParams.get('biz_content')!);
    expect(biz.total_amount).toBe('9.90');
    expect(biz.subject).toBe('测试课程');
    expect(url.searchParams.get('notify_url')).toBe('https://callback.example.com/api/v1/pay/notify');
    expect(url.hostname).toBe('openapi-sandbox.dl.alipaydev.com');
  });
});
