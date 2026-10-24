import { UserService } from './user.service';

describe('current account refresh', () => {
  it('loads the authenticated account profile and statistics without credentials', async () => {
    const record = { id: 'alice', name: 'Alice', wordNumber: 30, dayNumber: 4 };
    const findUnique = jest.fn().mockResolvedValue(record);
    const success = jest.fn(value => value);
    const service = new UserService({ user: { findUnique } } as any,
      { success } as any, null as any, null as any, null as any, null as any);
    expect(await service.getMe('alice')).toEqual(record);
    const query = findUnique.mock.calls[0][0];
    expect(query.where).toEqual({ id: 'alice' });
    expect(query.select).toMatchObject({ id: true, avatar: true, name: true, wordNumber: true, dayNumber: true });
    expect(query.select).not.toHaveProperty('password');
    expect(query.select).not.toHaveProperty('token');
  });

  it('returns an error when the account no longer exists', async () => {
    const error = jest.fn(() => ({ success: false }));
    const service = new UserService({ user: { findUnique: async () => null } } as any,
      { error } as any, null as any, null as any, null as any, null as any);
    expect(await service.getMe('deleted')).toEqual({ success: false });
  });
});
