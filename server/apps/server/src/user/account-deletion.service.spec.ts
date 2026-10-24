import { AccountDeletionService } from './account-deletion.service';

const query = jest.fn();
const release = jest.fn();
jest.mock('pg', () => ({ ...jest.requireActual('pg'), Pool: jest.fn(() => ({ connect: async () => ({ query, release }), end: jest.fn() })) }));

describe('account deletion', () => {
  let service: AccountDeletionService;
  let prisma: any;
  let queue: any;
  beforeEach(() => {
    query.mockReset().mockResolvedValue({ rows: [{ name: 'existing' }] });
    prisma = { user: { delete: jest.fn().mockResolvedValue({}) } };
    queue = { getJobs: jest.fn().mockResolvedValue([]) };
    service = new AccountDeletionService({ getOrThrow: () => 'test' } as any, prisma,
      { withUser: (_id, action) => action() } as any, queue);
  });
  it('rejects missing or incorrect second confirmation before touching data', async () => {
    await expect(service.deleteAccount('alice', 'yes')).rejects.toThrow('请输入');
    expect(queue.getJobs).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
  it('cleans only the authenticated user checkpoints and jobs before cascading the account', async () => {
    const own = { data: { userId: 'alice' }, isActive: async () => false, remove: jest.fn() };
    const other = { data: { userId: 'bob' }, remove: jest.fn() };
    queue.getJobs.mockResolvedValue([own, other]);
    await service.deleteAccount('alice', '注销账户');
    expect(own.remove).toHaveBeenCalledTimes(1);
    expect(other.remove).not.toHaveBeenCalled();
    const deletes = query.mock.calls.filter(([sql]) => sql.startsWith('DELETE'));
    expect(deletes).toHaveLength(3);
    for (const [sql, params] of deletes) {
      expect(sql).toContain('left(thread_id, length($1)) = $1');
      expect(params).toEqual(['alice-']);
    }
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'alice' } });
  });
  it('keeps the account retryable when checkpoint cleanup fails', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.startsWith('DELETE')) throw new Error('database unavailable');
      return { rows: [{ name: 'existing' }] };
    });
    await expect(service.deleteAccount('alice', '注销账户')).rejects.toThrow('database unavailable');
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
  it('refuses to delete while an email job is active', async () => {
    queue.getJobs.mockResolvedValue([{ data: { userId: 'alice' }, isActive: async () => true }]);
    await expect(service.deleteAccount('alice', '注销账户')).rejects.toThrow('正在处理');
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
