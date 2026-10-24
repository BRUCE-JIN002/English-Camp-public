import { TrackerService } from './tracker.service';

describe('tracker requests racing with account deletion', () => {
  let db: any;
  let service: TrackerService;
  beforeEach(() => {
    db = {
      visitor: { findUnique: jest.fn().mockResolvedValue({ id: 'v' }), upsert: jest.fn(), updateMany: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u' }) },
      pageView: { create: jest.fn() }, trackEvent: { create: jest.fn() },
      errorEntry: { create: jest.fn() }, performanceEntry: { create: jest.fn() },
    };
    service = new TrackerService(db, { success: (data) => ({ code: 200, data }) } as any);
  });
  it.each(['pv', 'event', 'error', 'performance', 'updateUv'])('ignores %s with a deleted visitor', async (method) => {
    db.visitor.findUnique.mockResolvedValue(null);
    expect(await service[method]({ visitorId: 'deleted' })).toEqual({ code: 200, data: false });
    expect(db.pageView.create).not.toHaveBeenCalled();
  });
  it('handles deletion between lookup and insert', async () => {
    db.visitor.findUnique.mockResolvedValueOnce({ id: 'v' }).mockResolvedValue(null);
    db.pageView.create.mockRejectedValue({ code: 'P2003' });
    expect(await service.pv({ visitorId: 'v', url: '/', path: '/', referrer: '' })).toEqual({ code: 200, data: false });
  });
  it('does not hide unrelated database failures', async () => {
    db.pageView.create.mockRejectedValue(new Error('connection lost'));
    await expect(service.pv({ visitorId: 'v' } as any)).rejects.toThrow('connection lost');
  });
  it('does not create anonymous visitors or recreate a deleted user', async () => {
    expect((await service.uv({ anonymousId: 'guest' } as any)).data).toBeNull();
    db.user.findUnique.mockResolvedValue(null);
    expect((await service.uv({ anonymousId: 'old', userId: 'deleted' } as any)).data).toBeNull();
    expect(db.visitor.upsert).not.toHaveBeenCalled();
  });
  it('still records valid PV requests', async () => {
    expect((await service.pv({ visitorId: 'v', url: '/', path: '/', referrer: '' })).data).toBe(true);
    expect(db.pageView.create).toHaveBeenCalledTimes(1);
  });
});
